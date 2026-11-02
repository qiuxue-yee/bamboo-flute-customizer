import { describe, expect, it, vi } from 'vitest';
import { CustomizationStore } from '../../src/state.js';

describe('customization history', () => {
  it('restores image identity and both offsets through undo and redo', () => {
    const store = new CustomizationStore();
    const first = store.setImage({ width: 100, height: 60 }, 'first.png');
    store.beginGesture();
    store.setOffset('u', 0.2);
    store.setOffset('u', 0.4);
    store.setOffset('v', -0.25);
    store.endGesture();
    const second = store.setImage({ width: 80, height: 80 }, 'second.png');
    store.clear();
    expect(store.snapshot()).toEqual({ imageId: null, fileName: '', u: 0, v: 0 });
    store.undo();
    expect(store.snapshot()).toEqual({ imageId: second, fileName: 'second.png', u: 0, v: 0 });
    store.undo();
    expect(store.snapshot()).toEqual({ imageId: first, fileName: 'first.png', u: 0.4, v: -0.25 });
    store.undo();
    expect(store.snapshot()).toEqual({ imageId: first, fileName: 'first.png', u: 0, v: 0 });
    store.redo();
    expect(store.snapshot()).toEqual({ imageId: first, fileName: 'first.png', u: 0.4, v: -0.25 });
    expect(store.resource(first).fileName).toBe('first.png');
    store.dispose();
  });

  it('retains the new image when upload ends a pending gesture', () => {
    const store = new CustomizationStore();
    store.setImage({ width: 1, height: 1 }, 'first.png');
    store.beginGesture();
    store.setOffset('u', 0.5);
    const second = store.setImage({ width: 1, height: 1 }, 'second.png');
    expect(store.resource(second).fileName).toBe('second.png');
    store.undo();
    expect(store.snapshot().u).toBe(0.5);
    store.dispose();
  });

  it('releases image resources only when history no longer refers to them', () => {
    const store = new CustomizationStore({ historyLimit: 1 });
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    store.setImage({ close: closeFirst }, 'first.png');
    store.setImage({ close: closeSecond }, 'second.png');
    expect(closeFirst).not.toHaveBeenCalled();
    store.setImage({}, 'third.png');
    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).not.toHaveBeenCalled();
    store.dispose();
    expect(closeSecond).toHaveBeenCalledOnce();
  });
});
