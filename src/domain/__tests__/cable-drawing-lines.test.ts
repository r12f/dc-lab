import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { fiberMap } from '../optics/fiber-map';
import { conductorPairs } from '../../features/optics/cable-drawing';

const lib = new Library(SHIPPED_CATALOG, emptyProject());

describe('cable drawing connects every connector', () => {
  it('every shipped cable has at least one A-B line, and every A and B connector is used', () => {
    for (const c of lib.cableMedia.items()) {
      const m = conductorPairs(c, fiberMap(c).pairs);
      expect(m.flat().some((n) => n > 0), c.id).toBe(true);
      if (c.type === 'copper-dac' || c.type === 'aec' || c.type === 'aoc') {
        expect(m.every((row) => row.some((n) => n > 0)), `${c.id} A`).toBe(true);
        expect(m[0].map((_, b) => m.some((row) => row[b] > 0)).every(Boolean), `${c.id} B`).toBe(true);
      }
    }
  });
  it('1 -> 2 breakout DAC: A1 to both B', () => {
    const c = lib.cableMedia.get('dac-400g-qsfpdd-2x200g')!;
    expect(conductorPairs(c, fiberMap(c).pairs)).toEqual([[1, 1]]);
  });
});
