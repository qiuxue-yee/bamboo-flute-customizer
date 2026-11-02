const emptyState = () => ({ imageId: null, fileName: '', u: 0, v: 0 });
const copy = state => ({ ...state });
const equal = (a, b) => a.imageId === b.imageId && a.fileName === b.fileName
  && a.u === b.u && a.v === b.v;
const clamp = value => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));

/** State contains only values; decoded images are held separately by stable ID. */
export class CustomizationStore {
  constructor({ historyLimit = 50 } = {}) {
    this.state = emptyState();
    this.resources = new Map();
    this.history = [];
    this.future = [];
    this.gesture = null;
    this.nextId = 0;
    this.historyLimit = historyLimit;
    this.listeners = new Set();
  }

  snapshot() { return copy(this.state); }
  resource(id = this.state.imageId) { return id ? this.resources.get(id) : undefined; }
  canUndo() { return this.history.length > 0 || Boolean(this.gesture && !equal(this.gesture, this.state)); }
  canRedo() { return this.future.length > 0; }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }

  commit(next) {
    this.endGesture();
    if (equal(this.state, next)) return;
    this.history.push(this.snapshot());
    if (this.history.length > this.historyLimit) this.history.shift();
    this.future = [];
    this.state = copy(next);
    this.collectResources();
    this.notify();
  }

  setImage(image, fileName) {
    this.endGesture();
    const id = `image-${++this.nextId}`;
    this.resources.set(id, { image, fileName });
    this.commit({ imageId: id, fileName, u: 0, v: 0 });
    return id;
  }

  clear() { this.commit(emptyState()); }

  beginGesture() {
    if (!this.gesture) this.gesture = this.snapshot();
  }

  setOffset(axis, value) {
    if (!this.state.imageId || !['u', 'v'].includes(axis)) return;
    this.beginGesture();
    const next = { ...this.state, [axis]: clamp(Number(value)) };
    if (!equal(this.state, next)) {
      this.state = next;
      this.notify();
    }
  }

  endGesture() {
    if (!this.gesture) return;
    const before = this.gesture;
    this.gesture = null;
    if (!equal(before, this.state)) {
      this.history.push(before);
      if (this.history.length > this.historyLimit) this.history.shift();
      this.future = [];
      this.collectResources();
      this.notify();
    }
  }

  resetPosition() { this.commit({ ...this.state, u: 0, v: 0 }); }

  undo() {
    this.endGesture();
    if (!this.history.length) return;
    this.future.push(this.snapshot());
    this.state = this.history.pop();
    this.collectResources();
    this.notify();
  }

  redo() {
    this.endGesture();
    if (!this.future.length) return;
    this.history.push(this.snapshot());
    this.state = this.future.pop();
    this.collectResources();
    this.notify();
  }

  collectResources() {
    const retained = new Set([this.state, ...this.history, ...this.future, this.gesture]
      .filter(Boolean).map(item => item.imageId).filter(Boolean));
    for (const [id, resource] of this.resources) {
      if (!retained.has(id)) {
        resource.image?.close?.();
        this.resources.delete(id);
      }
    }
  }

  dispose() {
    for (const resource of this.resources.values()) resource.image?.close?.();
    this.resources.clear();
    this.listeners.clear();
    this.history = [];
    this.future = [];
  }
}
