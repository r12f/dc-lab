import { describe, expect, it } from 'vitest';
import { Library } from '../library/Library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalogFixture';
import { newOptic, withPackaging, withPigtail } from '../optics/factory';
import { compatibleCables, cablesPerPort } from '../ports/opticMatch';
import { normalizeProject } from '../project/serializer';
import { buildRackBom } from '../bom/rackBom';
import { bomToCsv } from '../bom/csv';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import type { PropertyDef } from '../properties/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const osfp = lib.devices.get('switch-64x800g-osfp')!.ports.find((g) => g.id === 'osfp')!;

describe('optics catalog', () => {
  it('every built-in optic declares packaging', () => {
    expect(lib.optics.items().every((o) => o.packaging === 'module' || o.packaging === 'pigtail')).toBe(true);
  });
  it('pigtail keeps fiberConnector in sync with its legs', () => {
    const o = withPigtail(newOptic('x', 'pigtail'), { count: 2, connector: 'LC', fiberType: 'fiber-sm', lengthM: 2 });
    expect(o.fiberConnector).toBe('2x LC');
    expect(withPackaging(o, 'module').pigtail).toBeUndefined();
  });
  it('pigtail optic: cables match the end connector and count per leg', () => {
    const p = lib.optics.get('osfp-800g-2xdr4-pigtail')!;
    expect(compatibleCables(lib, osfp, p).every((c) => c.connector === 'MPO-12' && c.type === 'fiber-sm')).toBe(true);
    expect(cablesPerPort(osfp, p)).toBe(2);
  });
  it('legacy optics become modules', () => {
    const p = normalizeProject({ optics: [{ id: 'o', formFactor: 'OSFP', reach: 'DR8', speedGbps: 800 }] });
    expect(p.optics[0].packaging).toBe('module');
  });
  it('optic and cable custom properties show on their BOM lines', () => {
    const def: PropertyDef = { id: 'mfg', name: 'MFG', appliesTo: ['optic', 'cable'], type: 'text', showInBom: true };
    const l = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject(), [], { 'osfp-800g-2xdr4': { mfg: 'Acme' }, 'mpo12-smf': { mfg: 'FiberCo' } });
    const d = newDesign('d', 'D', 'network-42ru-600');
    const pl = newPlacement('p', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' });
    pl.groupSettings = { osfp: { mode: '2x400G', reach: '2xDR4', opticId: 'osfp-800g-2xdr4', cableId: 'mpo12-smf' } };
    d.placements.push(pl);
    const csv = bomToCsv(buildRackBom(l, d), [def]);
    expect(csv).toMatch(/800G OSFP 2xDR4,Optic,[^\n]*,Acme,64,/);
    expect(csv).toMatch(/MPO-12[^\n]*,Cable,[^\n]*,FiberCo,128,/);
  });
});
