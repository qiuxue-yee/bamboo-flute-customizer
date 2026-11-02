import * as THREE from 'three';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { expectedFiles, exportDesign } from '../../src/export.js';

const makePart = () => {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(10, 20, 30), new THREE.MeshStandardMaterial()));
  return root;
};
const fakeGlb = () => {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, meshes: [{ primitives: [{}] }] }));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(20 + jsonLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).fill(0x20);
  new Uint8Array(buffer, 20, json.length).set(json);
  return buffer;
};
const fakeStl = () => {
  const buffer = new ArrayBuffer(134);
  new DataView(buffer).setUint32(80, 1, true);
  return buffer;
};
const args = () => ({
  assets: { part1: makePart(), part2: makePart(), part3: makePart() },
  snapshot: { imageId: null, fileName: '', u: 0, v: 0 },
  format: 'zip',
  includeStl: true,
  exporters: {
    glb: vi.fn(async () => fakeGlb()),
    stl: vi.fn(async () => fakeStl()),
  },
});

describe('export package', () => {
  it('creates exactly the requested parts and keeps source transforms intact', async () => {
    const options = args();
    const result = await exportDesign(options);
    const zip = await JSZip.loadAsync(Buffer.from(await result.blob.arrayBuffer()));
    expect(Object.keys(zip.files).sort()).toEqual(expectedFiles('zip', true).sort());
    expect(options.exporters.glb).toHaveBeenCalledTimes(3);
    expect(options.exporters.stl).toHaveBeenCalledTimes(3);
    expect(options.assets.part3.scale.x).toBe(0.001);
  });

  it('stops before creating an archive if a required part or STL fails', async () => {
    const missing = args();
    missing.assets.part2 = null;
    await expect(exportDesign(missing)).rejects.toThrow('part2');
    expect(missing.exporters.glb).not.toHaveBeenCalled();
    const failed = args();
    failed.exporters.stl.mockRejectedValueOnce(new Error('bad mesh'));
    failed.zipFactory = vi.fn(() => new JSZip());
    await expect(exportDesign(failed)).rejects.toThrow('part1 STL: bad mesh');
    expect(failed.zipFactory).not.toHaveBeenCalled();
  });

  it('propagates ZIP failures instead of returning a partial archive', async () => {
    const options = args();
    options.zipFactory = () => ({ file() { throw new Error('disk failure'); } });
    await expect(exportDesign(options)).rejects.toThrow('ZIP: disk failure');
  });

  it('rejects nonempty but invalid GLB or STL output', async () => {
    const invalidGlb = args();
    invalidGlb.exporters.glb.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    await expect(exportDesign(invalidGlb)).rejects.toThrow('part1 GLB: Invalid GLB data');
    const invalidStl = args();
    invalidStl.exporters.stl.mockResolvedValue(new ArrayBuffer(85));
    await expect(exportDesign(invalidStl)).rejects.toThrow('part1 STL: Invalid STL triangle data');
  });

  it('exports just the customized third part for single-file formats', () => {
    expect(expectedFiles('glb')).toEqual(['Part_3_Customized.glb']);
    expect(expectedFiles('stl')).toEqual(['Part_3_Customized.stl']);
    expect(expectedFiles('zip', false)).toHaveLength(4);
  });
});
