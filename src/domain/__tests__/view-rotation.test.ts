import { describe, expect, it } from 'vitest';
import { labelAngle, planTransform, rotateBy, viewSize } from '../layout/view-rotation';

describe('DC layout view rotation', () => {
  it('steps by 90 in both directions and wraps', () => {
    expect(rotateBy(undefined, 90)).toBe(90);
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(0, -90)).toBe(270);
  });
  it('rotated plan keeps its origin and swaps width/depth at 90/270', () => {
    expect(viewSize(90, 20000, 16000)).toEqual({ w: 16000, h: 20000 });
    expect(planTransform(90, 20000, 16000)).toBe('translate(16000 0) rotate(90)');
    expect(planTransform(0, 1, 1)).toBe('');
  });
  it('labels: upright stays horizontal; along never reads upside down', () => {
    expect(labelAngle(90, 'upright')).toBe(-90);
    // A vertical aisle label (-90 in plan) in a 90° view lies horizontal on screen.
    expect(90 + labelAngle(90, 'along', -90)).toBe(0);
    // A horizontal label in a 180° view is flipped back.
    expect(180 + labelAngle(180, 'along', 0)).toBe(0);
    expect(270 + labelAngle(270, 'along', 0)).toBe(-90);
  });
});
