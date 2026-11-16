import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { cablePowerWPerEnd, opticPowerW } from '../items/variants';
import { bomItem, cableLengthPickKey } from '../design/bom-items';
import { newDesign } from '../design/factory';
import type { ItemVariant } from '../items/types';

const item = (target: ItemVariant['target'], itemId: string, w: number): ItemVariant =>
  ({ id: `${itemId}-x`, name: 'x', target, itemId, vendor: 'Acme', model: 'X-1', properties: {}, specs: { typicalW: w } });

describe('optic / cable item power overrides', () => {
  it('the picked item\'s power replaces the item type\'s; Generic / no override = the type\'s', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [item('optic', 'osfp-800g-2xdr4', 15), item('cable', 'aec-800g', 6)] });
    const o = lib.optics.get('osfp-800g-2xdr4')!;
    const c = lib.cableMedia.get('aec-800g')!;
    const d = newDesign('d', 'D', 'network-42ru-600');
    expect([opticPowerW(bomItem(lib, d, o.id), o), cablePowerWPerEnd(bomItem(lib, d, c.id), c)]).toEqual([o.powerW, c.powerWPerEnd ?? 0]);
    const picked = { ...d, bomItems: { [o.id]: `${o.id}-x`, [c.id]: `${c.id}-x` } };
    expect([opticPowerW(bomItem(lib, picked, o.id), o), cablePowerWPerEnd(bomItem(lib, picked, c.id), c)]).toEqual([15, 6]);
  });
  it('a cable length pick wins over the cable type pick; a pick of another item type is ignored', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [item('cable', 'aec-800g', 6), { ...item('cable', 'aec-800g', 7), id: 'len3' }] });
    const d = { ...newDesign('d', 'D', 'network-42ru-600'), bomItems: { 'aec-800g': 'aec-800g-x', [cableLengthPickKey('aec-800g', 3)]: 'len3', 'mpo8-smf': 'aec-800g-x' } };
    expect(bomItem(lib, d, 'aec-800g', cableLengthPickKey('aec-800g', 3))?.id).toBe('len3');
    expect(bomItem(lib, d, 'aec-800g', cableLengthPickKey('aec-800g', 2))?.id).toBe('aec-800g-x');
    expect(bomItem(lib, d, 'mpo8-smf')?.id).toBe('mpo8-smf--generic');
  });
});
