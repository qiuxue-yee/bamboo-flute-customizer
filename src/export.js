import JSZip from 'jszip';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { applyPattern, composePattern } from './pattern.js';

const PART_NAMES = Object.freeze({
  part1: 'Part_1_Printable',
  part2: 'Part_2_Printable',
  part3: 'Part_3_Customized',
});

export function expectedFiles(format, includeStl = false) {
  if (format === 'glb') return [PART_NAMES.part3 + '.glb'];
  if (format === 'stl') return [PART_NAMES.part3 + '.stl'];
  if (format !== 'zip') throw new Error('Unsupported export format');
  const glb = Object.values(PART_NAMES).map(name => name + '.glb');
  const stl = includeStl ? Object.values(PART_NAMES).map(name => name + '.stl') : [];
  return [...glb, ...stl, 'Manufacturing_Instructions.txt'];
}

function cloneForExport(source) {
  if (!source) throw new Error('Required model part is missing');
  const root = source.clone(true);
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    node.material = Array.isArray(node.material)
      ? node.material.map(material => material.clone())
      : node.material.clone();
  });
  root.updateMatrixWorld(true);
  return root;
}

function disposeCloneMaterials(root) {
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) material.dispose();
  });
}

function toGlb(root, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('GLB export timed out')), timeoutMs);
    try {
      new GLTFExporter().parse(root, result => {
        clearTimeout(timeout);
        if (!(result instanceof ArrayBuffer) || result.byteLength === 0) {
          reject(new Error('GLB export returned empty data'));
        } else resolve(result);
      }, { binary: true, embedImages: true, maxTextureSize: 2048, onlyVisible: true });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function toStl(root) {
  // STL is unitless; scale the meter-based clone so the numeric coordinates are mm.
  root.scale.multiplyScalar(1000);
  root.updateMatrixWorld(true);
  const result = new STLExporter().parse(root, { binary: true });
  if (!(result instanceof DataView) || result.byteLength <= 84) throw new Error('STL export returned empty data');
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

function validateGlb(data, requirePattern) {
  if (!(data instanceof ArrayBuffer) || data.byteLength < 20) throw new Error('Invalid GLB data');
  const view = new DataView(data);
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
      || view.getUint32(8, true) !== data.byteLength || view.getUint32(16, true) !== 0x4e4f534a
      || jsonLength < 2 || jsonLength > data.byteLength - 20) throw new Error('Invalid GLB header');
  let gltf;
  try { gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLength))); }
  catch { throw new Error('Invalid GLB metadata'); }
  if (gltf.asset?.version !== '2.0' || !gltf.meshes?.length) throw new Error('GLB has no model geometry');
  if (requirePattern) {
    const material = gltf.materials?.find(item => item.name === 'Custom_Area_Image');
    const texture = gltf.textures?.[material?.pbrMetallicRoughness?.baseColorTexture?.index];
    const image = gltf.images?.[texture?.source];
    if (!material?.extras?.customPattern || image?.bufferView == null || !gltf.bufferViews?.[image.bufferView]?.byteLength) {
      throw new Error('GLB is missing its embedded pattern');
    }
  }
}

function validateStl(data) {
  if (!(data instanceof ArrayBuffer) || data.byteLength < 84) throw new Error('Invalid STL data');
  const triangles = new DataView(data).getUint32(80, true);
  if (!triangles || data.byteLength !== 84 + triangles * 50) throw new Error('Invalid STL triangle data');
}

function instructions(files, includeStl, hasPattern) {
  return [
    'Bamboo flute export',
    '',
    'GLB coordinates: metres. STL coordinates: millimetres (STL is unitless).',
    'Legacy source coordinates are assumed to represent millimetres.',
    'STL contains geometry only; view the pattern on the GLB.',
    'Physical fit, print quality and tuning have not been verified.',
    '',
    'Software checks:',
    '- All three requested GLB files have valid headers and model metadata.',
    hasPattern ? '- The customized GLB contains an embedded pattern.' : '- No pattern was selected.',
    ...(includeStl ? ['- All three STL files have valid binary triangle data.'] : []),
    '',
    'Included files:',
    ...files.map(name => `- ${name}`),
    '',
  ].join('\n');
}

/** Returns a blob and filename; no download or UI side effects. */
export async function exportDesign({ assets, snapshot, image, background, format, includeStl = false,
  timeoutMs = 30000, zipFactory = () => new JSZip(), onProgress = () => {},
  exporters = { glb: toGlb, stl: toStl } }) {
  const fileNames = expectedFiles(format, includeStl);
  const required = format === 'zip' ? ['part1', 'part2', 'part3'] : ['part3'];
  for (const key of required) if (!assets[key]) throw new Error(`${key}: required model part is missing`);
  if (snapshot.imageId && !image) throw new Error('Pattern image is unavailable');
  const canvas = snapshot.imageId ? composePattern(image, snapshot, background) : null;
  const files = {};
  const exportOne = async (key, type) => {
    const model = cloneForExport(assets[key]);
    let cleanup = null;
    try {
      if (key === 'part3' && canvas && type === 'glb') cleanup = applyPattern(model, canvas);
      const data = await exporters[type](model, timeoutMs);
      if (type === 'glb') validateGlb(data, key === 'part3' && Boolean(canvas));
      else validateStl(data);
      return data;
    } catch (error) {
      throw new Error(`${key} ${type.toUpperCase()}: ${error.message}`);
    } finally {
      cleanup?.();
      disposeCloneMaterials(model);
    }
  };
  if (format !== 'zip') {
    onProgress(0, 1);
    const data = await exportOne('part3', format);
    onProgress(1, 1);
    return { blob: new Blob([data], { type: format === 'glb' ? 'model/gltf-binary' : 'model/stl' }), filename: fileNames[0], files: fileNames };
  }
  const work = [
    ...required.map(key => [key, 'glb']),
    ...(includeStl ? required.map(key => [key, 'stl']) : []),
  ];
  for (const [index, [key, type]] of work.entries()) {
    onProgress(index, work.length);
    files[PART_NAMES[key] + '.' + type] = await exportOne(key, type);
  }
  files['Manufacturing_Instructions.txt'] = instructions(fileNames, includeStl, Boolean(canvas));
  let blob;
  try {
    const zip = zipFactory();
    for (const [name, data] of Object.entries(files)) zip.file(name, data);
    blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    if (!blob?.size) throw new Error('Empty ZIP file');
  } catch (error) {
    throw new Error(`ZIP: ${error.message}`);
  }
  onProgress(work.length, work.length);
  return { blob, filename: 'Customized_Bamboo_Flute.zip', files: fileNames };
}

export function downloadBlob(blob, filename) {
  if (!blob?.size) throw new Error('Cannot download an empty file');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
