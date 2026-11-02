import { loadAssets, disposeObject } from './assets.js';
import { CustomizationStore } from './state.js';
import { FluteViewer } from './viewer.js';
import { applyPattern, baseColorFor, composePattern } from './pattern.js';
import { Localizer } from './i18n.js';
import { PRESETS } from './presets.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const byId = id => document.getElementById(id);

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* try browser image decoder */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
    image.src = url;
  });
}

export class App {
  constructor() {
    this.i18n = new Localizer();
    this.store = new CustomizationStore();
    this.assets = null;
    this.viewer = null;
    this.patternCleanup = null;
    this.patternFrame = null;
    this.loading = false;
    this.ready = false;
    this.busy = false;
    this.disposed = false;
    this.uploadSequence = 0;
    this.exportMessage = '';
    this.toastTimers = new Set();
    this.abort = new AbortController();
    this.unsubscribe = this.store.subscribe(() => this.scheduleRender());
    this.bind();
    this.i18n.apply();
    this.updateControls();
    this.scheduleRender();
    this.initialize();
  }

  bind() {
    const signal = this.abort.signal;
    const on = (id, event, handler) => byId(id).addEventListener(event, handler, { signal });
    for (const preset of PRESETS) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'preset-button';
      button.dataset.preset = preset.id; button.setAttribute('aria-pressed', 'false');
      const image = document.createElement('img'); image.src = preset.url; image.alt = '';
      const label = document.createElement('span'); label.className = 'preset-label'; label.dataset.i18n = preset.labelKey;
      button.append(image, label); byId('preset-grid').appendChild(button);
      button.addEventListener('click', () => this.choosePreset(preset), { signal });
    }
    on('view-full-btn', 'click', () => this.setView('full'));
    on('view-detail-btn', 'click', () => this.setView('detail'));
    this.bindPatternDrag(signal);
    let dragDepth = 0;
    on('pattern-upload', 'dragenter', event => {
      event.preventDefault(); dragDepth++; if (!this.busy && this.ready) byId('pattern-upload').classList.add('is-dragging');
    });
    on('pattern-upload', 'dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
    on('pattern-upload', 'dragleave', event => {
      event.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; byId('pattern-upload').classList.remove('is-dragging'); }
    });
    on('pattern-upload', 'drop', event => {
      event.preventDefault(); dragDepth = 0; byId('pattern-upload').classList.remove('is-dragging');
      this.acceptImage(event.dataTransfer?.files?.[0]);
    });
    document.addEventListener('dragover', event => event.preventDefault(), { signal });
    document.addEventListener('drop', event => event.preventDefault(), { signal });
    on('language-select', 'change', event => {
      this.i18n.setLanguage(event.target.value);
      this.updateText();
      this.scheduleRender();
    });
    on('retry-btn', 'click', () => this.initialize());
    on('pattern-upload', 'click', () => byId('image-input').click());
    on('image-input', 'change', event => this.upload(event));
    on('clear-image-btn', 'click', () => {
      this.uploadSequence++;
      byId('image-input').value = '';
      this.store.clear();
    });
    for (const [id, axis] of [['u-slider', 'u'], ['v-slider', 'v']]) {
      on(id, 'pointerdown', () => this.store.beginGesture());
      on(id, 'input', event => this.store.setOffset(axis, event.target.value));
      on(id, 'change', () => this.store.endGesture());
      on(id, 'pointercancel', () => this.store.endGesture());
      on(id, 'blur', () => this.store.endGesture());
    }
    on('reset-position-btn', 'click', () => this.store.resetPosition());
    on('undo-btn', 'click', () => this.store.undo());
    on('redo-btn', 'click', () => this.store.redo());
    on('reset-view-btn', 'click', () => this.viewer?.resetCamera());
    on('export-format-select', 'change', () => this.updateControls());
    on('export-model-btn', 'click', () => this.startExport());
    on('open-guide-btn', 'click', () => byId('guide-dialog').showModal());
    on('close-guide-btn', 'click', () => byId('guide-dialog').close());
    on('guide-dialog', 'click', event => { if (event.target === byId('guide-dialog')) byId('guide-dialog').close(); });
    window.addEventListener('keydown', event => {
      if (this.busy || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName)
        || (target.tagName === 'INPUT' && target.type !== 'range'))) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) { event.preventDefault(); this.store.redo(); }
      else if (key === 'z') { event.preventDefault(); this.store.undo(); }
      else if (key === 'y') { event.preventDefault(); this.store.redo(); }
    }, { signal });
    window.addEventListener('beforeunload', () => this.dispose(), { signal });
  }

  async initialize() {
    if (this.loading || this.disposed) return;
    this.loading = true;
    this.ready = false;
    this.loadError = null;
    this.updateText();
    this.updateControls();
    let assets;
    try {
      assets = await loadAssets();
      if (this.disposed) {
        Object.values(assets).forEach(disposeObject);
        return;
      }
      this.patternCleanup?.();
      this.patternCleanup = null;
      this.viewer?.dispose();
      this.viewer = null;
      if (this.assets) Object.values(this.assets).forEach(disposeObject);
      this.assets = assets;
      this.background = baseColorFor(assets.display);
      this.viewer = new FluteViewer(byId('canvas-container'), assets.display, {
        onContextLost: () => {
          if (this.disposed) return;
          this.ready = false;
          this.loadError = { kind: 'webglLost' };
          this.updateText();
          this.updateControls();
        },
      });
      this.viewer.renderer.domElement.setAttribute('aria-label', this.i18n.text('viewerLabel'));
      this.ready = true;
      this.setView(this.store.state.imageId ? 'detail' : 'full', false);
      this.scheduleRender();
    } catch (error) {
      console.error('Model initialization failed:', error);
      if (assets && assets !== this.assets) Object.values(assets).forEach(disposeObject);
      this.loadError = error;
    } finally {
      this.loading = false;
      if (!this.disposed) { this.updateText(); this.updateControls(); }
    }
  }

  async upload(event) {
    const file = event.target.files?.[0];
    // Reset the real input so selecting the same file fires change again.
    event.target.value = '';
    return this.acceptImage(file);
  }

  async choosePreset(preset) {
    if (!this.ready || this.busy) return;
    const sequence = ++this.uploadSequence;
    try {
      const response = await fetch(preset.url);
      if (!response.ok) throw new Error('Preset could not be loaded');
      const file = new File([await response.blob()], preset.fileName, { type: 'image/svg+xml' });
      if (sequence === this.uploadSequence) await this.acceptImage(file, { internal: true, sequence });
    } catch (error) {
      console.error('Preset loading failed:', error);
      if (sequence === this.uploadSequence) this.toast('uploadDecodeError');
    }
  }

  async acceptImage(file, options = {}) {
    if (!file || !this.ready || this.busy) return;
    const sequence = options.sequence ?? ++this.uploadSequence;
    if (!IMAGE_TYPES.has(file.type.toLowerCase()) && !(options.internal && file.type === 'image/svg+xml')) { this.toast('uploadTypeError'); return; }
    if (file.size > MAX_IMAGE_BYTES) { this.toast('uploadSizeError'); return; }
    try {
      const image = await decodeImage(file);
      if (this.disposed || sequence !== this.uploadSequence || this.busy) {
        image.close?.();
        return;
      }
      if (!(image.width > 0 && image.height > 0)) {
        image.close?.();
        throw new Error('Empty image');
      }
      this.store.setImage(image, file.name);
      this.setView('detail');
    } catch (error) {
      console.error('Image decode failed:', error);
      if (sequence === this.uploadSequence) this.toast('uploadDecodeError');
    }
  }

  setView(mode, animate = true) {
    if (!this.viewer) return;
    this.viewer.setView(mode, animate);
    byId('view-full-btn').setAttribute('aria-pressed', String(mode === 'full'));
    byId('view-detail-btn').setAttribute('aria-pressed', String(mode === 'detail'));
  }

  bindPatternDrag(signal) {
    const canvas = byId('image-preview');
    let drag = null;
    const end = event => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      const pointerId = drag.pointerId; drag = null;
      canvas.classList.remove('is-dragging');
      this.store.endGesture();
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    };
    canvas.addEventListener('pointerdown', event => {
      if (!this.ready || this.busy || !this.store.state.imageId || event.button !== 0) return;
      const bounds = canvas.getBoundingClientRect();
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        width: bounds.width, height: bounds.height, ...this.store.snapshot() };
      this.store.beginGesture(); canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging'); event.preventDefault();
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      this.store.setOffset('u', drag.u + 2 * (event.clientX - drag.x) / drag.width);
      this.store.setOffset('v', drag.v - 2 * (event.clientY - drag.y) / drag.height);
    }, { signal });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, end, { signal });
    canvas.addEventListener('keydown', event => {
      if (this.busy || !this.store.state.imageId || event.ctrlKey || event.metaKey) return;
      const move = { ArrowLeft: ['u', -0.02], ArrowRight: ['u', 0.02], ArrowUp: ['v', 0.02], ArrowDown: ['v', -0.02] }[event.key];
      if (!move) return;
      event.preventDefault(); event.stopPropagation();
      this.store.setOffset(move[0], this.store.state[move[0]] + move[1]); this.store.endGesture();
    }, { signal });
  }

  scheduleRender() {
    if (this.patternFrame || this.disposed) return;
    this.patternFrame = requestAnimationFrame(() => {
      this.patternFrame = null;
      this.renderPattern();
    });
  }

  renderPattern() {
    const state = this.store.snapshot();
    const preview = byId('image-preview');
    const ctx = preview.getContext('2d');
    this.patternCleanup?.();
    this.patternCleanup = null;
    ctx.clearRect(0, 0, preview.width, preview.height);
    if (this.background && typeof this.background !== 'string') ctx.drawImage(this.background, 0, 0, preview.width, preview.height);
    else { ctx.fillStyle = this.background || '#e0c596'; ctx.fillRect(0, 0, preview.width, preview.height); }
    if (state.imageId && this.assets?.display) {
      try {
        const canvas = composePattern(this.store.resource(state.imageId)?.image, state, this.background);
        this.patternCleanup = applyPattern(this.assets.display, canvas);
        ctx.drawImage(canvas, 0, 0, preview.width, preview.height);
      } catch (error) {
        console.error('Pattern rendering failed:', error);
        this.toast('renderingError');
      }
    }
    const selected = PRESETS.find(preset => preset.fileName === state.fileName);
    byId('file-name-display').textContent = selected ? this.i18n.text(selected.labelKey) : state.fileName || this.i18n.text('noFile');
    byId('file-name-display').title = state.fileName;
    byId('preview-status').textContent = this.i18n.text(state.imageId ? 'patternApplied' : 'noPattern');
    byId('u-slider').value = state.u;
    byId('v-slider').value = state.v;
    byId('u-value').textContent = state.u.toFixed(2);
    byId('v-value').textContent = state.v.toFixed(2);
    this.viewer?.requestRender();
    this.updateControls();
  }

  updateText() {
    byId('loading-overlay').hidden = this.ready;
    byId('loading-spinner').hidden = !this.loading;
    byId('retry-btn').hidden = !this.loadError || this.loading;
    byId('loading-message').textContent = this.i18n.text(this.loadError ? (this.loadError.kind || 'loadingFailed') : 'loading');
    byId('loading-detail').hidden = !this.loadError?.message || Boolean(this.loadError?.kind);
    byId('loading-detail').textContent = this.loadError?.kind ? '' : this.loadError?.message || '';
    byId('app-status').textContent = this.ready ? this.i18n.text('ready') : '';
    byId('export-status').textContent = this.exportMessage ? this.i18n.text(this.exportMessage, this.exportValues) : '';
    this.viewer?.renderer.domElement.setAttribute('aria-label', this.i18n.text('viewerLabel'));
  }

  updateControls() {
    const locked = !this.ready || this.busy;
    for (const id of ['pattern-upload', 'export-format-select', 'include-stl-checkbox', 'export-model-btn', 'reset-view-btn']) {
      byId(id).disabled = locked;
    }
    const hasImage = Boolean(this.store.state.imageId);
    document.querySelector('.right-panel').classList.toggle('has-pattern', hasImage);
    byId('pattern-editor').hidden = !hasImage;
    byId('history-actions').hidden = !hasImage && !this.store.canUndo() && !this.store.canRedo();
    byId('reset-position-btn').hidden = !hasImage;
    for (const button of document.querySelectorAll('[data-preset]')) {
      button.disabled = locked;
      const preset = PRESETS.find(item => item.id === button.dataset.preset);
      button.setAttribute('aria-pressed', String(this.store.state.fileName === preset.fileName));
    }
    byId('view-full-btn').disabled = locked;
    byId('view-detail-btn').disabled = locked;
    for (const id of ['clear-image-btn', 'u-slider', 'v-slider', 'reset-position-btn']) byId(id).disabled = locked || !hasImage;
    byId('undo-btn').disabled = locked || !this.store.canUndo();
    byId('redo-btn').disabled = locked || !this.store.canRedo();
    byId('stl-option').hidden = byId('export-format-select').value !== 'zip';
  }

  async startExport() {
    if (!this.ready || this.busy) return;
    this.store.endGesture();
    this.busy = true;
    this.exportMessage = 'exporting';
    this.exportValues = {};
    this.updateText();
    this.updateControls();
    const snapshot = this.store.snapshot();
    try {
      const { downloadBlob, exportDesign } = await import('./export.js');
      const result = await exportDesign({
        assets: this.assets,
        snapshot,
        image: this.store.resource(snapshot.imageId)?.image,
        background: this.background,
        format: byId('export-format-select').value,
        includeStl: byId('include-stl-checkbox').checked,
        onProgress: (current, total) => {
          this.exportMessage = 'exportProgress';
          this.exportValues = { current: Math.min(current + 1, total), total };
          this.updateText();
        },
      });
      downloadBlob(result.blob, result.filename);
      this.exportMessage = 'exported';
      this.exportValues = {};
    } catch (error) {
      console.error('Export failed:', error);
      const part = /^part([123])(?:\s+(GLB|STL))?:/i.exec(error.message);
      this.exportMessage = part ? 'exportFailedPart' : error.message.startsWith('ZIP:') ? 'exportFailedZip' : 'exportFailed';
      this.exportValues = part ? { part: part[1], format: part[2] ? `(${part[2].toUpperCase()})` : '' } : {};
      this.toast(this.exportMessage, this.exportValues);
    } finally {
      this.busy = false;
      this.updateText();
      this.updateControls();
    }
  }

  toast(key, values = {}) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = this.i18n.text(key, values);
    byId('toast-container').appendChild(element);
    const timer = setTimeout(() => {
      this.toastTimers.delete(timer);
      element.remove();
    }, 4500);
    this.toastTimers.add(timer);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.unsubscribe();
    for (const timer of this.toastTimers) clearTimeout(timer);
    this.toastTimers.clear();
    byId('toast-container').replaceChildren();
    if (this.patternFrame) cancelAnimationFrame(this.patternFrame);
    this.patternCleanup?.();
    this.viewer?.dispose();
    if (this.assets) Object.values(this.assets).forEach(disposeObject);
    this.store.dispose();
  }
}
