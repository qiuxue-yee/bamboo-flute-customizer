import * as THREE from 'three';

// Image UVs are calibrated to the same physical patch on both models.
export const PATTERN_SIZE = Object.freeze({ width: 1024, height: 565 });
export const IMAGE_MATERIAL = 'Custom_Area_Image';

export function calculatePlacement(imageWidth, imageHeight, state, size = PATTERN_SIZE) {
  if (!(imageWidth > 0 && imageHeight > 0)) throw new Error('Invalid image dimensions');
  const scale = Math.min(size.width * 0.85 / imageWidth, size.height * 0.85 / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (size.width - width) / 2 + Math.max(-1, Math.min(1, state.u)) * size.width / 2,
    y: (size.height - height) / 2 - Math.max(-1, Math.min(1, state.v)) * size.height / 2,
    width,
    height,
  };
}

export function findImageMaterials(root) {
  const targets = [];
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material, index) => {
      if (material?.name === IMAGE_MATERIAL) targets.push({ node, index, material });
    });
  });
  return targets;
}

export function baseColorFor(root) {
  const material = findImageMaterials(root)[0]?.material;
  if (!material) throw new Error('Image customization area is missing from the model');
  // GLTF material colors are linear; the 2D canvas stores sRGB values.
  return material.map?.image || `#${material.color.clone().convertLinearToSRGB().getHexString()}`;
}

export function composePattern(image, state, background, makeCanvas = () => document.createElement('canvas')) {
  if (!image) throw new Error('Pattern image is unavailable');
  const canvas = makeCanvas();
  canvas.width = PATTERN_SIZE.width;
  canvas.height = PATTERN_SIZE.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create the pattern canvas');
  if (typeof background === 'string') {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.drawImage(background, 0, 0, canvas.width, canvas.height);
  }
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const placement = calculatePlacement(width, height, state, canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  return canvas;
}

/** Replace only the image material and return a cleanup function. */
export function applyPattern(root, canvas) {
  const targets = findImageMaterials(root);
  if (!targets.length) throw new Error('Image customization area is missing from the model');
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const originals = new Map();
  const created = [];
  for (const { node, index, material } of targets) {
    if (!originals.has(node)) originals.set(node, node.material);
    const replacement = material.clone();
    replacement.color.set(0xffffff);
    replacement.map = texture;
    replacement.userData = { ...replacement.userData, customPattern: true };
    replacement.transparent = false;
    replacement.needsUpdate = true;
    created.push(replacement);
    if (Array.isArray(node.material)) {
      const materials = node.material.slice();
      materials[index] = replacement;
      node.material = materials;
    } else {
      node.material = replacement;
    }
  }
  return () => {
    for (const [node, original] of originals) node.material = original;
    for (const material of created) material.dispose();
    texture.dispose();
  };
}
