import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { resolvePort } from '../device/port-settings';
import { modesOf, findProfile } from '../device/breakout';
import { compatibleCables, compatibleOptics, portConnectors, reachOptions } from '../ports/optic-match';
import { moduleFits } from '../ports/form-factors';
import { normalizeProject } from '../project/serializer';
import { portItemCounts } from '../design/optics';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const dev = (id: string) => lib.devices.get(id)!;

describe('form factor compatibility', () => {
  it('QSFP-DD accepts QSFP28, OSFP accepts only OSFP', () => {
    expect(moduleFits('QSFP-DD', 'QSFP28')).toBe(true);
    expect(moduleFits('OSFP', 'QSFP-DD')).toBe(false);
    expect(moduleFits('QSFP28', 'QSFP-DD')).toBe(false);
  });
  it('cage offers native speeds of compatible older modules', () => {
    const g = dev('switch-32x800g-qsfpdd').ports[0];
    expect(modesOf(g)).toEqual(expect.arrayContaining(['1x800G', '2x400G', '1x400G', '1x200G', '1x100G', '1x40G']));
  });
});

describe('speed and reach are independent', () => {
  const osfp = dev('switch-64x800g-osfp');
  const g = osfp.ports[0];
  it('module types: every module the cage takes at <= port speed and of its heat sink', () => {
    // IHS 800G cage: IHS modules only (all 800G+); RHS 1.6T cage also takes the (RHS) 400G OSFP modules.
    expect(reachOptions(lib, g, '1x800G')).toEqual(expect.arrayContaining(['2xDR4', '2xFR4', 'DR8', 'DAC']));
    expect(reachOptions(lib, g, '1x800G')).not.toContain('SR4');
    expect(reachOptions(lib, dev('switch-64x1600g-osfp').ports[0], '1x1600G')).toEqual(expect.arrayContaining(['2xDR4', 'SR4', 'DR4']));
  });
  it('module is auto-picked from cage + speed + reach', () => {
    const r = resolvePort(lib, osfp, 'osfp/5', { id: 'p', name: 'p', groupDefaults: { osfp: { reach: '2xFR4' } }, overrides: {} });
    expect(r?.optic?.id).toBe('osfp-800g-2xfr4-ihs');
    expect(r?.autoOptic).toBe(true);
  });
  it('QSFP28 LR4 module goes into an 800G QSFP-DD cage at 100G', () => {
    const q = dev('switch-32x800g-qsfpdd');
    const r = resolvePort(lib, q, 'qdd/1', findProfile(q, 'mixed-compat'));
    expect(r?.mode).toBe('1x100G');
    expect(r?.optic?.id).toBe('qsfp28-100g-lr4');
    expect(resolvePort(lib, q, 'qdd/3', findProfile(q, 'mixed-compat'))?.optic?.id).toBe('qsfpdd-800g-2xfr4');
  });
  it('cables follow the module fiber connector', () => {
    const fr4 = lib.optics.get('osfp-800g-2xfr4');
    expect(compatibleCables(lib, g, fr4).map((c) => c.ends.a.connector)).toEqual(expect.arrayContaining(['LC']));
    expect(compatibleCables(lib, g, fr4).every((c) => (c.ends.a.connector === 'LC' || c.ends.b.connector === 'LC') && c.type === 'fiber-sm')).toBe(true);
    const sr4 = lib.optics.get('qsfp28-100g-sr4');
    expect(compatibleCables(lib, g, sr4).map((c) => c.id)).toEqual(['mpo12-mmf']);
  });
});

describe('CPO / NPO fiber ports', () => {
  const cpo = dev('switch-cpo-128x800g-mpo');
  const g = cpo.ports[0];
  it('have engine reaches, no modules, cables match the port connector', () => {
    expect(reachOptions(lib, g, '1x800G')).toEqual(['DR8', '2xDR4']);
    expect(compatibleOptics(lib, g, '1x800G')).toEqual([]);
    expect(compatibleCables(lib, g).map((c) => c.id)).toContain('mmc-smf');
    expect(compatibleCables(lib, g).every((c) => /^MMC/.test(c.ends.a.connector) || /^MMC/.test(c.ends.b.connector))).toBe(true);
    const r = resolvePort(lib, cpo, 'mpo/1', findProfile(cpo, 'all-2x400g-dr4'));
    expect(r).toMatchObject({ mode: '2x400G', reach: '2xDR4', cableId: 'mmc-smf' });
    expect(r?.optic).toBeUndefined();
  });
  it('ELSFP laser cages count as modules in the BOM', () => {
    const r = resolvePort(lib, cpo, 'els/1', findProfile(cpo, 'all-2x400g-dr4'));
    expect(r?.optic?.id).toBe('elsfp-laser');
  });
});

describe('cable count per port', () => {
  it('2xDR4 module needs two MPO-12 trunks per port (cable set on the placement, not the profile)', () => {
    const osfp = dev('switch-64x800g-osfp');
    const placement = { id: 'p', deviceId: osfp.id, label: 'SW1', mount: { kind: 'rack' as const, position: 1, face: 'front' as const },
      breakoutProfileId: 'all-2x400g', portSettings: {}, groupSettings: { osfp: { cableId: 'mpo12-smf' } } };
    const counts = portItemCounts(lib, osfp, placement);
    expect(counts.optics.get('osfp-800g-2xdr4-ihs')).toBe(64);
    expect(counts.cables.get('mpo12-smf')).toBe(128);
  });
});

describe('migration', () => {
  it('connector -> formFactor, optic media -> reach', () => {
    const p = normalizeProject({
      devices: [{ id: 'x', ports: [{ id: 'q', label: 'Q', connector: 'QSFP28' }], breakoutProfiles: [] }],
      optics: [{ id: 'o', connector: 'OSFP', media: '2xDR4', speedGbps: 800 }],
    });
    expect(p.devices[0].ports[0].formFactor).toBe('QSFP28');
    expect(p.optics[0]).toMatchObject({ formFactor: 'OSFP', reach: '2xDR4', fiberConnector: '2x MPO-12' });
  });
});

describe('port connectors', () => {
  it('2xDR4 = 2 x MPO-12, 2xFR4 = 2 x LC, DAC/empty = none, CPO 2xDR4 = 1 x port connector', () => {
    const osfp = dev('switch-64x800g-osfp').ports.find((g) => g.id === 'osfp')!;
    expect(portConnectors(osfp, lib.optics.get('osfp-800g-2xdr4'))).toEqual({ count: 2, connector: 'MPO-12', gender: 'male' });
    expect(portConnectors(osfp, lib.optics.get('osfp-800g-2xfr4'))).toEqual({ count: 2, connector: 'LC' });
    expect(portConnectors(osfp)).toBeUndefined();
    const cpo = lib.devices.items().flatMap((d) => d.ports).find((g) => g.opticalEngine)!;
    expect(portConnectors(cpo)).toEqual({ count: 1, connector: 'MMC-16' });
  });
});

describe('QSFP-DD800 removal', () => {
  it('migrates the form factor and the old built-in device id', () => {
    const p = normalizeProject({
      devices: [{ id: 'x', ports: [{ id: 'q', label: 'QSFP-DD800', formFactor: 'QSFP-DD800', role: 'data' }], breakoutProfiles: [] }],
      optics: [{ id: 'o', formFactor: 'QSFP-DD800', packaging: 'module' }],
      rackDesigns: [{ id: 'd', placements: [{ id: 'p', deviceId: 'switch-32x800g-qsfpdd800' }], cables: [] }],
      hiddenBuiltins: ['switch-32x800g-qsfpdd800'], builtinProperties: { 'switch-32x800g-qsfpdd800': { a: 1 } },
    });
    expect(p.devices[0].ports[0]).toMatchObject({ formFactor: 'QSFP-DD', label: 'QSFP-DD' });
    expect(p.optics[0].formFactor).toBe('QSFP-DD');
    expect(p.rackDesigns[0].placements[0].deviceId).toBe('switch-32x800g-qsfpdd');
    expect(p.hiddenBuiltins).toEqual([]);
    expect(p.builtinProperties).toEqual({ 'switch-32x800g-qsfpdd': { a: 1 } });
  });
});
