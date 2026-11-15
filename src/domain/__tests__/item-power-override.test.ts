import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { cablePowerWPerEnd, opticPowerW } from '../items/variants';
import type { ItemVariant } from '../items/types';

const item = (target: ItemVariant['target'], itemId: string, w: number): ItemVariant =>
  ({ id: `${itemId}-x`, name: 'x', target, itemId, vendor: 'Acme', model: 'X-1', isDefault: true, properties: {}, specs: { typicalW: w } });

describe('optic / cable item power overrides', () => {
  it('the default item\'s power replaces the item type\'s; no override = the type\'s', () => {
    const base = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const o = base.optics.get('osfp-800g-2xdr4')!;
    const c = base.cableMedia.get('aec-800g')!;
    expect([opticPowerW(base, o), cablePowerWPerEnd(base, c)]).toEqual([o.powerW, c.powerWPerEnd ?? 0]);
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [item('optic', o.id, 15), item('cable', c.id, 6)] });
    expect([opticPowerW(lib, o), cablePowerWPerEnd(lib, c)]).toEqual([15, 6]);
  });
});
