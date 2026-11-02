import * as THREE from 'three';

const AXIAL_END = 612.4;
const AXIAL_SPAN = 642.4;
let surfaces;

// One physical color field for the whole tube and its calibrated image patch.
// Grain follows the tube axis; it never changes vertices or manufacturing units.
function colorAt(axial, angle) {
  const fiber = Math.sin(angle * 143 + Math.sin(axial * 0.023) * 0.4) * 2.1
    + Math.sin(angle * 319 + axial * 0.009) * 1.1;
  const broad = Math.sin(angle * 13 + axial * 0.004) * 3.8
    + Math.sin(axial * 0.012) * 1.8;
  const streak = Math.pow(Math.max(0, Math.sin(angle * 83 + Math.sin(axial * 0.01))), 18) * 4;
  const shade = fiber + broad - streak;
  return [194 + shade, 161 + shade, 106 + shade * 0.75];
}

function paint(width, height, position) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [axial, angle] = position(x / (width - 1), y / (height - 1));
      const color = colorAt(axial, angle);
      const index = (y * width + x) * 4;
      pixels.data[index] = color[0]; pixels.data[index + 1] = color[1];
      pixels.data[index + 2] = color[2]; pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function bambooSurfaces() {
  if (!surfaces) {
    surfaces = {
      body: paint(2048, 512, (u, v) => [AXIAL_END - u * AXIAL_SPAN, (v - 0.5) * 2 * Math.PI]),
      pattern: paint(1024, 565, (u, v) => [AXIAL_END - u * 71.2, (v - 0.5) * Math.PI]),
    };
  }
  return surfaces;
}

function makeTexture(canvas, wrap = false) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function applyBambooFinish(root) {
  const surface = bambooSurfaces();
  const bodyTexture = makeTexture(surface.body, true);
  const patchTexture = makeTexture(surface.pattern);
  root.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    // GLTFLoader separates these material primitives into individual meshes.
    const patch = materials.some(material => material?.name === 'Custom_Area_Image');
    if (!patch) {
      const previous = node.geometry;
      const geometry = previous.index ? previous.toNonIndexed() : previous.clone();
      const positions = geometry.attributes.position;
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        uv[i * 2] = (AXIAL_END - positions.getY(i)) / AXIAL_SPAN;
        uv[i * 2 + 1] = (Math.atan2(positions.getZ(i), positions.getX(i)) + Math.PI) / (2 * Math.PI);
      }
      for (let i = 0; i < positions.count; i += 3) {
        const values = [uv[i * 2 + 1], uv[(i + 1) * 2 + 1], uv[(i + 2) * 2 + 1]];
        if (Math.max(...values) - Math.min(...values) > 0.5) {
          for (let j = 0; j < 3; j++) if (values[j] < 0.5) uv[(i + j) * 2 + 1] += 1;
        }
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      node.geometry = geometry;
      previous.dispose();
    }
    const replacements = materials.map(original => {
      const material = original.clone();
      material.color.set(0xffffff);
      material.map = patch ? patchTexture : bodyTexture;
      material.metalness = 0;
      material.roughness = 0.72;
      material.needsUpdate = true;
      original.dispose();
      return material;
    });
    node.material = Array.isArray(node.material) ? replacements : replacements[0];
    node.castShadow = true;
    node.receiveShadow = true;
  });
}
