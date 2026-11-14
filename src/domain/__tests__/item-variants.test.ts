import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { normalizeProject } from '../project/serializer';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { buildRackBom } from '../bom/rack-bom';
import type { ItemVariant } from '../items/types';

const acme: ItemVariant = { id: 'a1', name: 'Acme X', target: 'device', itemId: 'switch-64x800g-osfp', vendor: 'Acme', model: 'SW-6400', properties: { lead: 12 } };
const libWith = (variants: ItemVariant[], props = {}) => new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants }, [], props);

describe('items of item types', () => {
  it('every item type has a generic default item', () => {
    const lib = libWith([]);
    const v = lib.variants.defaultOf('switch-64x800g-osfp')!;
    expect(v).toMatchObject({ id: 'switch-64x800g-osfp--generic', vendor: 'Generic', target: 'device' });
    expect(lib.variants.defaultOf('osfp-800g-2xdr4')?.target).toBe('optic');
    expect(lib.variants.defaultOf('mpo8-smf')?.target).toBe('cable');
  });
  it('project items join the generic one; isDefault picks the default', () => {
    expect(libWith([acme]).variants.of('switch-64x800g-osfp').map((v) => v.id)).toEqual(['switch-64x800g-osfp--generic', 'a1']);
    expect(libWith([{ ...acme, isDefault: true }]).variants.defaultOf('switch-64x800g-osfp')?.id).toBe('a1');
  });
  it('BOM lines are per item, with vendor / model and item properties', () => {
    const lib = libWith([acme], { 'switch-64x800g-osfp--generic': { lead: 3 } });
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('p1', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }));
    d.placements.push({ ...newPlacement('p2', 'switch-64x800g-osfp', 'SW2', { kind: 'rack', position: 3, face: 'front' }), variantId: 'a1' });
    const lines = buildRackBom(lib, d).filter((l) => l.kind === 'device');
    expect(lines.map((l) => [l.vendorModel, l.qty, l.properties?.lead])).toEqual([
      ['Generic 64x800G OSFP Switch (2PSU)', 1, 3], ['Acme SW-6400', 1, 12],
    ]);
  });
  it('migrates vendor/model/properties from item types to generic items', () => {
    const p = normalizeProject({ devices: [{ id: 'my-sw', name: 'My SW', vendor: 'Acme', model: 'X1', properties: { lead: 4 }, ports: [], breakoutProfiles: [] }] });
    expect(p.devices[0]).not.toHaveProperty('vendor');
    expect(p.variants).toEqual([{ id: 'my-sw--generic', name: 'X1', target: 'device', itemId: 'my-sw', vendor: 'Acme', model: 'X1', properties: { lead: 4 } }]);
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, p);
    expect(lib.variants.of('my-sw')).toHaveLength(1);
    expect(lib.variants.defaultOf('my-sw')?.vendor).toBe('Acme');
  });
  it('a deleted generic item stays deleted', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [acme] }, ['switch-64x800g-osfp--generic']);
    expect(lib.variants.of('switch-64x800g-osfp').map((v) => v.id)).toEqual(['a1']);
  });
});
