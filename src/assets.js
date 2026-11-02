import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import displayUrl from '../assets/generated/Dizi_Display.glb?url';
import part1Url from '../assets/Part_1_Printable.glb?url';
import part2Url from '../assets/Part_2_Printable.glb?url';
import part3Url from '../assets/generated/Part_3_Printable_Source.glb?url';
import { findImageMaterials } from './pattern.js';
import { applyBambooFinish } from './bamboo.js';

// Original GLB coordinates were authored numerically in mm. Each loaded asset
// receives this one explicit conversion; authored assembly coordinates remain intact.
export const ASSET_MANIFEST = Object.freeze([
  { id: 'display', url: displayUrl, legacyToMeters: 0.001 },
  { id: 'part1', url: part1Url, legacyToMeters: 0.001 },
  { id: 'part2', url: part2Url, legacyToMeters: 0.001 },
  { id: 'part3', url: part3Url, legacyToMeters: 0.001 },
]);

export function disposeObject(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function loadOne(entry, timeoutMs) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`${entry.id}: loading timed out`));
    }, timeoutMs);
    loader.load(entry.url, gltf => {
      clearTimeout(timer);
      if (timedOut) { disposeObject(gltf.scene); return; }
      const root = new THREE.Group();
      root.name = entry.id;
      root.scale.setScalar(entry.legacyToMeters);
      root.add(gltf.scene);
      root.updateMatrixWorld(true);
      let meshCount = 0;
      root.traverse(node => { if (node.isMesh) meshCount++; });
      if (!meshCount || (['display', 'part3'].includes(entry.id) && !findImageMaterials(root).length)) {
        disposeObject(root);
        reject(new Error(`${entry.id}: required model geometry or image area is missing`));
        return;
      }
      resolve(root);
    }, undefined, error => {
      clearTimeout(timer);
      reject(new Error(`${entry.id}: ${error?.message || 'model could not be loaded'}`));
    });
  });
}

export async function loadAssets({ timeoutMs = 30000, manifest = ASSET_MANIFEST } = {}) {
  const results = await Promise.allSettled(manifest.map(entry => loadOne(entry, timeoutMs)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) {
    for (const result of results) if (result.status === 'fulfilled') disposeObject(result.value);
    throw failed.reason;
  }
  const assets = Object.fromEntries(manifest.map((entry, index) => [entry.id, results[index].value]));
  try {
    for (const asset of Object.values(assets)) applyBambooFinish(asset);
  } catch (error) {
    Object.values(assets).forEach(disposeObject);
    throw error;
  }
  return assets;
}

export function dimensions(root) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
}
