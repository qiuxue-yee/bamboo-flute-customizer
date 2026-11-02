import { describe, expect, it } from 'vitest';
import { calculatePlacement, PATTERN_SIZE } from '../../src/pattern.js';

describe('pattern placement', () => {
  it('preserves aspect ratio and centers the image by default', () => {
    const result = calculatePlacement(400, 200, { u: 0, v: 0 });
    expect(result.width / result.height).toBeCloseTo(2);
    expect(result.x + result.width / 2).toBeCloseTo(PATTERN_SIZE.width / 2);
    expect(result.y + result.height / 2).toBeCloseTo(PATTERN_SIZE.height / 2);
  });

  it('moves without wrapping and clamps offsets to the control range', () => {
    const centered = calculatePlacement(100, 100, { u: 0, v: 0 });
    const moved = calculatePlacement(100, 100, { u: 3, v: -1 });
    expect(moved.x - centered.x).toBe(PATTERN_SIZE.width / 2);
    expect(moved.y - centered.y).toBe(PATTERN_SIZE.height / 2);
    expect(moved.x + moved.width).toBeGreaterThan(PATTERN_SIZE.width);
    expect(() => calculatePlacement(0, 20, { u: 0, v: 0 })).toThrow();
  });
});
