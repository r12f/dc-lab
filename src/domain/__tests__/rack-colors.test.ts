import { describe, expect, it } from 'vitest';
import { categoryStyle, LAYOUT_PAINT, layoutColorVars, RACK_FRAME, rackColorVars } from '../../theme/paint';
import { THEMES } from '../../theme/registry';
import { themeToCssVars } from '../../theme/css-vars';
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
  it('every DC Layout rack and trace paint is defined for light and dark', () => {
    const used = [...Object.values(LAYOUT_PAINT.rack).flatMap((r) => Object.values(r)), ...LAYOUT_PAINT.traces]
      .map((p) => /var\((--[^)]+)\)/.exec(p)![1]);
    for (const theme of THEMES) {
      const v = themeToCssVars(theme);
      for (const k of used) expect(v[k], `${theme.id} ${k}`).toBeTruthy();
    }
  });
  it('every theme takes the layout palette of its scheme, with a distinct colour per IT rack design', () => {
    for (const theme of THEMES) {
      const v = themeToCssVars(theme);
      expect(v['--lay-rack-it0']).toBe(layoutColorVars({ scheme: theme.scheme })['--lay-rack-it0']);
      expect(new Set([0, 1, 2, 3, 4, 5].map((i) => v[`--lay-rack-it${i}`])).size).toBe(6);
    }
  });});
