import { describe, expect, it } from 'vitest';

/** Red / orange / yellow hue (incl. pinks next to red) with real saturation: reserved for error / warning. */
function isAlertHue(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.12) return false;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h < 70 || h > 330;
}

const sources = import.meta.glob(
  ['../../features/devices/drawing/*.{ts,tsx}', '../../features/layout/*.{ts,tsx}', '../../features/designer/*.{ts,tsx}',
    '../../features/optics/optic-drawing.tsx', '../../domain/optics/factory.ts', '../../theme/paint.ts', '../../catalog/cables/*.json'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('drawing colors never use red / orange / yellow (error / warning only)', () => {
  it('has sources', () => expect(Object.keys(sources).length).toBeGreaterThan(20));
  it.each(Object.keys(sources))('%s', (f) => {
    const hexes = sources[f].match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexes.filter(isAlertHue)).toEqual([]);
  });
});
