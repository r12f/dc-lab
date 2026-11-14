import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { compatibleCables, connectorForReach } from '../ports/optic-match';
import { connectorsMate } from '../optics/connectors';
import { resolvePort } from '../device/port-settings';

describe('module reach fixes the cable connector', () => {
  it('DR4 / PSM4 -> MPO-8/12; DR1 / FR4 / LR4 -> LC', () => {
    for (const r of ['DR4', 'PSM4', '2xDR4', 'SR4']) expect(connectorForReach(r), r).toBe('MPO-12');
    for (const r of ['DR1', 'FR4', 'LR4', '2xFR4', 'ER4', 'ZR']) expect(connectorForReach(r), r).toBe('LC');
    expect(connectorsMate(connectorForReach('DR4')!, 'MPO-8')).toBe(true);
    expect(connectorForReach('DAC')).toBeUndefined();
  });
  it('every shipped optic follows the rule', () => {
    for (const o of SHIPPED_CATALOG.optics) {
      const want = connectorForReach(o.reach);
      if (!want || !o.fiberConnector) continue;
      expect(connectorsMate(want, o.fiberConnector.replace(/^\d+x\s*/i, '')), `${o.id} ${o.reach} ${o.fiberConnector}`).toBe(true);
    }
  });
  it('cables offered on a port follow its module: DR4 -> MPO only, DR1 -> LC only', () => {
    const lib = new Library(SHIPPED_CATALOG, emptyProject());
    const sw = lib.devices.get('switch-64x100g-qsfp28')!;
    const cablesFor = (reach: string) => {
      const r = resolvePort(lib, sw, 'qsfp28/1', { id: 'x', name: 'x', groupDefaults: { qsfp28: { reach } }, overrides: {} })!;
      return compatibleCables(lib, r.group, r.optic, r.reach, r.mode);
    };
    const dr4 = cablesFor('DR4');
    const dr1 = cablesFor('DR1');
    expect(dr4.length).toBeGreaterThan(0);
    expect(dr4.every((c) => [c.ends.a.connector, c.ends.b.connector].some((x) => /MPO/.test(x)))).toBe(true);
    expect(dr4.some((c) => c.ends.a.connector === 'LC' && c.ends.b.connector === 'LC')).toBe(false);
    expect(dr1.length).toBeGreaterThan(0);
    expect(dr1.every((c) => [c.ends.a.connector, c.ends.b.connector].includes('LC'))).toBe(true);
  });
});
