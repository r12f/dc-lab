import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { modulesOfType, opticFitsCage, reachOptions } from '../ports/optic-match';
import { heatSinkOf } from '../ports/form-factors';
import type { PortGroup } from '../device/types';

const lib = new Library(SHIPPED_CATALOG, emptyProject());
const osfp = (id: string) => lib.devices.get(id)!.ports.find((g) => g.formFactor === 'OSFP')!;

describe('module heat sink: IHS / RHS', () => {
  it('optics below 800G are RHS; 800G and up ship in both IHS and RHS', () => {
    for (const o of SHIPPED_CATALOG.optics.filter((x) => x.speedGbps < 800)) expect(heatSinkOf(o), o.id).toBe('RHS');
    const big = SHIPPED_CATALOG.optics.filter((x) => x.speedGbps >= 800);
    for (const o of big.filter((x) => heatSinkOf(x) === 'RHS')) {
      const twin = big.find((x) => x.id === `${o.id}-ihs`);
      expect(twin && [heatSinkOf(twin), twin.reach, twin.speedGbps, twin.name], o.id).toEqual(['IHS', o.reach, o.speedGbps, o.name.replace(/RHS$/, 'IHS')]);
    }
  });
  it('a cage takes only modules of its heat sink', () => {
    const ihs = osfp('switch-64x800g-osfp');
    const rhs = osfp('switch-64x1600g-osfp');
    expect([heatSinkOf(ihs), heatSinkOf(rhs)]).toEqual(['IHS', 'RHS']);
    expect(modulesOfType(lib, ihs, '2xDR4').every((o) => heatSinkOf(o) === 'IHS')).toBe(true);
    expect(modulesOfType(lib, rhs, '2xDR4').every((o) => heatSinkOf(o) === 'RHS')).toBe(true);
    expect(modulesOfType(lib, ihs, '2xDR4').length).toBeGreaterThan(0);
    const g: PortGroup = { ...ihs, heatSink: 'IHS' };
    expect(opticFitsCage(g, lib.optics.get('osfp-800g-2xdr4')!)).toBe(false);
    expect(opticFitsCage(g, lib.optics.get('osfp-800g-2xdr4-ihs')!)).toBe(true);
  });
  it('an IHS cage offers no sub-800G (RHS-only) module types; an unset cage is RHS', () => {
    expect(reachOptions(lib, osfp('switch-64x800g-osfp'), '1x800G')).not.toContain('SR4');
    const qdd = lib.devices.get('switch-32x400g-qsfpdd')!.ports[0];
    expect(heatSinkOf(qdd)).toBe('RHS');
    expect(modulesOfType(lib, qdd, 'DR4').length).toBeGreaterThan(0);
  });
});
