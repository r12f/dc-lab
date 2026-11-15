import { describe, expect, it } from 'vitest';
import { categoryStyle, RACK_FRAME, rackColorVars } from '../../theme/paint';
import { DEVICE_CATEGORIES } from '../device/categories';

describe('rack colors per scheme', () => {
  it('every paint used by the rack frame and categories is defined for light and dark, and they differ', () => {
    const used = [...Object.values(RACK_FRAME), ...DEVICE_CATEGORIES.flatMap((c) => Object.values(categoryStyle(c)))]
      .map((p) => /var\((--[^)]+)\)/.exec(p)![1]);
    const light = rackColorVars('light');
    const dark = rackColorVars('dark');
    for (const v of used) {
      expect(light[v], v).toMatch(/^#/);
      expect(dark[v], v).toMatch(/^#/);
    }
    expect(dark['--rk-switch-fill']).not.toBe(light['--rk-switch-fill']);
  });
});
