import { describe, expect, it } from 'vitest';
import { stepZoom, ZOOM_STEPS } from '../../ui/canvas-frame';

describe('canvas zoom steps', () => {
  it('steps in and out through the list and clamps at the ends', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(ZOOM_STEPS[0], -1)).toBe(ZOOM_STEPS[0]);
    expect(stepZoom(ZOOM_STEPS.at(-1)!, 1)).toBe(ZOOM_STEPS.at(-1));
  });
});
