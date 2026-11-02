import { expect, test } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#loading-overlay')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#app-status')).toHaveText('Flute ready');
}

async function makePattern(page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 400, 220);
    ctx.strokeStyle = '#777'; ctx.lineWidth = 1;
    for (let x = 0; x <= 400; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 220); ctx.stroke(); }
    for (let y = 0; y <= 220; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke(); }
    ctx.fillStyle = '#e32323'; ctx.fillRect(15, 10, 160, 100);
    ctx.fillStyle = '#135cc9'; ctx.fillRect(260, 130, 120, 75);
    ctx.fillStyle = '#111'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('ABC →', 45, 180);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'directional.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') };
}

async function uploadPattern(page, file) {
  await page.locator('#image-input').setInputFiles(file || await makePattern(page));
  await expect(page.locator('#file-name-display')).toHaveText('directional.png');
  await expect(page.locator('#preview-status')).toHaveText('Pattern applied');
}

async function download(page, format, includeStl = true) {
  await page.locator('#export-format-select').selectOption(format);
  if (format === 'zip') {
    await page.locator('#include-stl-checkbox').setChecked(includeStl);
  }
  const pending = page.waitForEvent('download');
  await page.locator('#export-model-btn').click();
  const result = await pending;
  return { download: result, data: await readFile(await result.path()) };
}

async function glbInfo(page, buffer, comparePreview = false) {
  return page.evaluate(async ({ encoded, comparePreview }) => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { dimensions } = await import('/src/assets.js');
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer, '', resolve, reject));
    const size = dimensions(gltf.scene).toArray().map(value => value * 1000);
    let image = null;
    let customPattern = false;
    let bodyHasFinish = false;
    gltf.scene.traverse(node => {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material?.name === 'Dizi_Body') bodyHasFinish = Boolean(material.map) && material.roughness >= 0.65;
        if (material?.name === 'Custom_Area_Image' && material.map) {
          image = material.map.image;
          customPattern = Boolean(material.userData.customPattern);
        }
      }
    });
    let pixelDifference = null;
    if (image && comparePreview) {
      const reference = document.getElementById('image-preview');
      const copy = document.createElement('canvas');
      copy.width = reference.width; copy.height = reference.height;
      const context = copy.getContext('2d');
      context.drawImage(image, 0, 0, copy.width, copy.height);
      const actual = context.getImageData(0, 0, copy.width, copy.height).data;
      const expected = reference.getContext('2d').getImageData(0, 0, copy.width, copy.height).data;
      let maximum = 0;
      for (let i = 0; i < actual.length; i += 4 * 101) {
        for (let channel = 0; channel < 4; channel++) {
          maximum = Math.max(maximum, Math.abs(actual[i + channel] - expected[i + channel]));
        }
      }
      pixelDifference = maximum;
    }
    return { size, hasPattern: customPattern, pixelDifference, bodyHasFinish };
  }, { encoded: buffer.toString('base64'), comparePreview });
}

function stlSize(buffer) {
  const triangles = buffer.readUInt32LE(80);
  expect(buffer.length).toBe(84 + triangles * 50);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let triangle = 0; triangle < triangles; triangle++) {
    const start = 84 + triangle * 50 + 12;
    for (let point = 0; point < 3; point++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = buffer.readFloatLE(start + point * 12 + axis * 4);
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
    }
  }
  return min.map((value, index) => max[index] - value);
}

function expectSameDimensions(actual, expected) {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(0.1);
}

test('loads the whole flute and keeps its model separate from printable parts', async ({ page }) => {
  await ready(page);
  const info = await page.evaluate(async () => {
    const { dimensions } = await import('/src/assets.js');
    const app = window.app;
    return {
      displayed: app.viewer.visual.children[0] === app.assets.display,
      otherInScene: app.viewer.visual.children.includes(app.assets.part3),
      size: dimensions(app.assets.display.clone(true)).toArray().sort((a, b) => a - b).map(value => value * 1000),
      canvases: document.querySelectorAll('#canvas-container canvas').length,
    };
  });
  expect(info.displayed).toBe(true);
  expect(info.otherInScene).toBe(false);
  expect(info.canvases).toBe(1);
  expectSameDimensions(info.size, [25, 25, 642.4]);
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/verified-desktop.png', fullPage: true });
});

test('uploads, moves, clears, undoes and reuploads the same image', async ({ page }) => {
  await ready(page);
  const file = await makePattern(page);
  await uploadPattern(page, file);
  await page.locator('#u-slider').fill('0.35');
  await page.locator('#v-slider').fill('-0.25');
  await expect(page.locator('#u-value')).toHaveText('0.35');
  await expect(page.locator('#v-value')).toHaveText('-0.25');
  await page.locator('#clear-image-btn').click();
  await expect(page.locator('#file-name-display')).toHaveText('No file chosen');
  await page.locator('#undo-btn').click();
  await expect(page.locator('#file-name-display')).toHaveText('directional.png');
  await expect(page.locator('#u-value')).toHaveText('0.35');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Control+Shift+Z');
  await expect(page.locator('#file-name-display')).toHaveText('No file chosen');
  await uploadPattern(page, file);
  await expect(page.locator('#u-value')).toHaveText('0.00');
});

test('rejects unsupported, corrupt and oversized images without losing the current image', async ({ page }) => {
  await ready(page);
  await uploadPattern(page);
  await page.locator('#image-input').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('.toast').last()).toContainText('Choose a PNG');
  await page.locator('#image-input').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not png') });
  await expect(page.locator('.toast').last()).toContainText('could not be opened');
  await page.locator('#image-input').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.locator('.toast').last()).toContainText('5 MB');
  await expect(page.locator('#file-name-display')).toHaveText('directional.png');
});

test('GLB and STL retain physical size; GLB embeds the currently visible texture', async ({ page }) => {
  await ready(page);
  const pattern = await makePattern(page);
  await mkdir('output/playwright', { recursive: true });
  await writeFile('output/playwright/directional.png', pattern.buffer);
  await uploadPattern(page, pattern);
  await page.locator('#u-slider').fill('0.35');
  await page.locator('#v-slider').fill('-0.2');
  await expect(page.locator('#v-value')).toHaveText('-0.20');
  const expected = await page.evaluate(async () => {
    const { dimensions } = await import('/src/assets.js');
    return dimensions(window.app.assets.part3).toArray().map(value => value * 1000);
  });
  const glb = await download(page, 'glb');
  const glbData = await glbInfo(page, glb.data, true);
  expectSameDimensions(glbData.size, expected);
  expect(glbData.hasPattern).toBe(true);
  expect(glbData.bodyHasFinish).toBe(true);
  expect(glbData.pixelDifference).toBeLessThanOrEqual(1);
  const stl = await download(page, 'stl');
  expectSameDimensions(stlSize(stl.data), expected);
  await mkdir('output/playwright', { recursive: true });
  await glb.download.saveAs('output/playwright/verified-part3.glb');
  await stl.download.saveAs('output/playwright/verified-part3.stl');
  await page.locator('#clear-image-btn').click();
  const cleared = await download(page, 'glb');
  const clearedInfo = await glbInfo(page, cleared.data);
  expect(clearedInfo.hasPattern).toBe(false);
  expect(clearedInfo.bodyHasFinish).toBe(true);
  await page.locator('#undo-btn').click();
  await expect(page.locator('#preview-status')).toHaveText('Pattern applied');
  const restored = await download(page, 'glb');
  const restoredInfo = await glbInfo(page, restored.data, true);
  expect(restoredInfo.hasPattern).toBe(true);
  expect(restoredInfo.pixelDifference).toBeLessThanOrEqual(1);
  await page.locator('#redo-btn').click();
  const clearedAgain = await download(page, 'glb');
  expect((await glbInfo(page, clearedAgain.data)).hasPattern).toBe(false);
});

test('presets, pointer dragging and keyboard positioning share undo and export state', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#pattern-editor')).toBeHidden();
  await page.locator('[data-preset="leaves"]').click();
  await expect(page.locator('[data-preset="leaves"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#file-name-display')).toHaveText('Bamboo leaves');
  await expect(page.locator('#pattern-editor')).toBeVisible();
  await page.waitForFunction(() => window.app.viewer.viewMode === 'detail' && !window.app.viewer.transition);
  await page.locator('#view-full-btn').click();
  await page.waitForFunction(() => !window.app.viewer.transition);
  const historyBefore = await page.evaluate(() => window.app.store.history.length);
  const preview = page.locator('#image-preview');
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#u-value')).toHaveText('0.40');
  await expect(page.locator('#v-value')).toHaveText('0.20');
  expect(await page.evaluate(() => window.app.store.history.length)).toBe(historyBefore + 1);
  expect(await page.evaluate(() => window.app.viewer.viewMode)).toBe('full');
  await page.locator('#undo-btn').click();
  await expect(page.locator('#u-value')).toHaveText('0.00');
  await page.locator('#redo-btn').click();
  await expect(page.locator('#u-value')).toHaveText('0.40');
  await preview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#u-value')).toHaveText('0.42');
  const glb = await download(page, 'glb');
  expect((await glbInfo(page, glb.data, true)).pixelDifference).toBeLessThanOrEqual(1);
  await page.locator('[data-preset="flow"]').click();
  await expect(page.locator('[data-preset="flow"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#undo-btn').click();
  await expect(page.locator('[data-preset="leaves"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#u-value')).toHaveText('0.42');
  await page.locator('#reset-position-btn').click();
  await page.locator('#view-detail-btn').click();
  await page.waitForFunction(() => !window.app.viewer.transition);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.querySelector('.panel-content').scrollTop = 0; document.activeElement.blur(); });
  await page.screenshot({ path: 'output/playwright/workbench-detail.png', fullPage: true });
});

test('drop upload works and reduced-motion view changes are immediate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const file = await makePattern(page);
  const transfer = await page.evaluateHandle(encoded => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    transfer.items.add(new File([bytes], 'directional.png', { type: 'image/png' }));
    return transfer;
  }, file.buffer.toString('base64'));
  await page.locator('#pattern-upload').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('#file-name-display')).toHaveText('directional.png');
  expect(await page.evaluate(() => window.app.viewer.viewMode)).toBe('detail');
  expect(await page.evaluate(() => window.app.viewer.transition)).toBeNull();
  await page.locator('#view-full-btn').click();
  expect(await page.evaluate(() => window.app.viewer.viewMode)).toBe('full');
  expect(await page.evaluate(() => window.app.viewer.transition)).toBeNull();
});

test('exports the displayed texture at centered, positive, negative and clipped positions', async ({ page }) => {
  await ready(page);
  await uploadPattern(page);
  for (const [u, v] of [[0, 0], [0.65, 0.35], [-0.65, -0.35], [1, 1], [-1, -1]]) {
    await page.locator('#u-slider').fill(String(u));
    await page.locator('#v-slider').fill(String(v));
    await expect(page.locator('#u-value')).toHaveText(u.toFixed(2));
    await expect(page.locator('#v-value')).toHaveText(v.toFixed(2));
    const glb = await download(page, 'glb');
    const result = await glbInfo(page, glb.data, true);
    expect(result.hasPattern).toBe(true);
    expect(result.pixelDifference).toBeLessThanOrEqual(1);
  }
  await page.locator('#reset-position-btn').click();
  await expect(page.locator('#u-value')).toHaveText('0.00');
  await expect(page.locator('#v-value')).toHaveText('0.00');
  await page.screenshot({ path: 'output/playwright/verified-pattern.png', fullPage: true });
});

test('ZIP contains all requested files and fails clearly if a part is missing', async ({ page }) => {
  await ready(page);
  await uploadPattern(page);
  const result = await download(page, 'zip', true);
  const zip = await JSZip.loadAsync(result.data);
  expect(Object.keys(zip.files).sort()).toEqual([
    'Manufacturing_Instructions.txt', 'Part_1_Printable.glb', 'Part_1_Printable.stl',
    'Part_2_Printable.glb', 'Part_2_Printable.stl', 'Part_3_Customized.glb', 'Part_3_Customized.stl',
  ].sort());
  const text = await zip.file('Manufacturing_Instructions.txt').async('string');
  expect(text).toContain('millimetres');
  expect(text).toContain('embedded pattern');
  expect(text).toContain('valid binary triangle data');
  for (const part of ['Part_1_Printable', 'Part_2_Printable', 'Part_3_Customized']) {
    const glb = await zip.file(part + '.glb').async('nodebuffer');
    const stl = await zip.file(part + '.stl').async('nodebuffer');
    expectSameDimensions((await glbInfo(page, glb)).size, stlSize(stl));
  }
  const glbOnly = await download(page, 'zip', false);
  const glbZip = await JSZip.loadAsync(glbOnly.data);
  expect(Object.keys(glbZip.files)).toHaveLength(4);
  expect(Object.keys(glbZip.files).some(name => name.endsWith('.stl'))).toBe(false);
  await page.evaluate(() => { window.savedPart2 = window.app.assets.part2; window.app.assets.part2 = null; });
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.locator('#export-model-btn').click();
  await expect(page.locator('#export-status')).toContainText('Part 2');
  await page.waitForTimeout(500);
  expect(downloaded).toBe(false);
  await page.evaluate(() => { window.app.assets.part2 = window.savedPart2; });
});

test('shows a load error, then retries without duplicating the viewer', async ({ page }) => {
  const route = route => route.abort();
  const modelRequest = url => url.pathname.endsWith('/assets/generated/Part_3_Printable_Source.glb') && !url.search;
  await page.route(modelRequest, route);
  await page.goto('/');
  await expect(page.locator('#retry-btn')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#loading-message')).toHaveText('The model could not be loaded.');
  await expect(page.locator('#export-model-btn')).toBeDisabled();
  await page.unroute(modelRequest, route);
  await page.locator('#retry-btn').click();
  await expect(page.locator('#loading-overlay')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#canvas-container canvas')).toHaveCount(1);
  await expect(page.locator('#app-status')).toHaveText('Flute ready');
});

test('limits view shortcuts to the focused canvas and stops rendering while idle', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => !window.app.viewer.frame && !window.app.viewer.transition);
  const camera = () => page.evaluate(() => window.app.viewer.camera.position.toArray());
  const before = await camera();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowLeft');
  expect(await camera()).toEqual(before);
  await page.locator('#canvas-container canvas').focus();
  await page.keyboard.press('ArrowLeft');
  expect(await camera()).not.toEqual(before);
  await page.locator('#open-guide-btn').click();
  const modalCamera = await camera();
  await page.keyboard.press('ArrowLeft');
  expect(await camera()).toEqual(modalCamera);
  await page.locator('#close-guide-btn').click();
  await page.waitForFunction(() => !window.app.viewer.frame && !window.app.viewer.transition);
  const frames = await page.evaluate(() => {
    const renderer = window.app.viewer.renderer;
    window.__renderCount = 0;
    const render = renderer.render.bind(renderer);
    renderer.render = (...args) => { window.__renderCount++; return render(...args); };
    return window.__renderCount;
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__renderCount)).toBe(frames);
  await page.locator('[data-preset="leaves"]').click();
  await expect.poll(() => page.evaluate(() => window.__renderCount)).toBeGreaterThan(frames);
});

test('reports unavailable WebGL and restores a design after context loss', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.__blockWebGL = true;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (window.__blockWebGL && ['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#loading-message')).toContainText('browser supports WebGL');
  await page.evaluate(() => { window.__blockWebGL = false; });
  await page.locator('#retry-btn').click();
  await expect(page.locator('#app-status')).toHaveText('Flute ready');
  await page.locator('[data-preset="leaves"]').click();
  await page.locator('#u-slider').fill('0.35');
  await expect(page.locator('#u-value')).toHaveText('0.35');
  await page.evaluate(() => {
    const extension = window.app.viewer.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context is unavailable in the test browser');
    extension.loseContext();
  });
  await expect(page.locator('#loading-message')).toContainText('3D view was interrupted');
  await expect(page.locator('#export-model-btn')).toBeDisabled();
  await page.locator('#retry-btn').click();
  await expect(page.locator('#app-status')).toHaveText('Flute ready');
  await expect(page.locator('#file-name-display')).toHaveText('Bamboo leaves');
  await expect(page.locator('#u-value')).toHaveText('0.35');
  await expect(page.locator('#canvas-container canvas')).toHaveCount(1);
});

test.describe('touchscreen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('keeps editing controls and download actions accessible on a narrow screen', async ({ page }) => {
    await ready(page);
    await page.locator('#language-select').selectOption('zh');
    await page.locator('[data-preset="leaves"]').click();
    await expect(page.locator('#preview-status')).toHaveText('图案已应用');
    const sizes = await page.evaluate(() => {
      const selectors = ['#open-guide-btn', '#language-select', '#view-full-btn', '#view-detail-btn',
        '#reset-view-btn', '#pattern-upload', '#clear-image-btn', '#u-slider', '#v-slider',
        '#reset-position-btn', '#undo-btn', '#redo-btn', '#export-format-select', '#export-model-btn', '.checkbox-row'];
      return selectors.map(selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { selector, width: box.width, height: box.height };
      });
    });
    for (const target of sizes) {
      expect(target.width, target.selector).toBeGreaterThanOrEqual(44);
      expect(target.height, target.selector).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('#v-slider').scrollIntoViewIfNeeded();
    expect(await page.locator('#v-slider').evaluate(element => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top === element;
    })).toBe(true);
  });
  test('switches language, remembers it and completes a mobile interaction', async ({ page }) => {
  await ready(page);
  await page.locator('#language-select').selectOption('zh');
  await expect(page.locator('h1')).toHaveText('竹笛定制');
  await page.reload();
  await expect(page.locator('#loading-overlay')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('h1')).toHaveText('竹笛定制');
  await expect(page.locator('#pattern-upload')).toContainText('选择图片');
  await expect(page.locator('.view-help-touch')).toBeVisible();
  await expect(page.locator('.view-help-touch')).toHaveText('拖动旋转 · 双指缩放');
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    canvas: document.querySelector('#canvas-container').getBoundingClientRect().width,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.canvas).toBeGreaterThan(300);
  const box = await page.locator('#canvas-container canvas').boundingBox();
  const session = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  const before = await page.evaluate(() => window.app.viewer.camera.position.toArray());
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x + 60 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.app.viewer.camera.position.toArray());
  expect(after.some((value, index) => Math.abs(value - before[index]) > 0.00001)).toBe(true);
  await page.locator('#reset-view-btn').click();
  const distanceBefore = await page.evaluate(() => window.app.viewer.camera.position.distanceTo(window.app.viewer.controls.target));
  const left = { x: point.x - 25, y: point.y, id: 1 };
  const right = { x: point.x + 25, y: point.y, id: 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...left, x: left.x - 35 }, { ...right, x: right.x + 35 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  const distanceAfter = await page.evaluate(() => window.app.viewer.camera.position.distanceTo(window.app.viewer.controls.target));
  expect(distanceAfter).toBeLessThan(distanceBefore);
  await page.locator('#image-input').setInputFiles(await makePattern(page));
  await expect(page.locator('#file-name-display')).toHaveText('directional.png');
  await expect(page.locator('#preview-status')).toHaveText('图案已应用');
  await page.locator('#u-slider').fill('0.2');
  await expect(page.locator('#u-value')).toHaveText('0.20');
  await page.locator('#image-preview').scrollIntoViewIfNeeded();
  const editorBox = await page.locator('#image-preview').boundingBox();
  const editorPoint = { x: editorBox.x + editorBox.width / 2, y: editorBox.y + editorBox.height / 2, id: 1 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [editorPoint] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...editorPoint, x: editorPoint.x + editorBox.width * 0.1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#u-value')).toHaveText('0.40');
  const glb = await download(page, 'glb');
  const exported = await glbInfo(page, glb.data, true);
  expect(exported.pixelDifference).toBeLessThanOrEqual(1);
  const expected = await page.evaluate(async () => {
    const { dimensions } = await import('/src/assets.js');
    return dimensions(window.app.assets.part3).toArray().map(value => value * 1000);
  });
  expectSameDimensions(exported.size, expected);
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/verified-mobile-zh.png', fullPage: true });
  });
});
