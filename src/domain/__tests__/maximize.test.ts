import { describe, expect, it } from 'vitest';
import { useMaximize } from '../../state/maximize';

describe('canvas maximize', () => {
  it('starts restored and toggles', () => {
    expect(useMaximize.getState().maximized).toBe(false);
    useMaximize.getState().setMaximized(true);
    expect(useMaximize.getState().maximized).toBe(true);
    useMaximize.getState().setMaximized(false);
    expect(useMaximize.getState().maximized).toBe(false);
  });
});
