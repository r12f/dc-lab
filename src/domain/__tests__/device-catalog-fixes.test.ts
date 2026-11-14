import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { layoutFace } from '../../features/devices/drawing/faceplate-layout';

const dev = (id: string) => SHIPPED_CATALOG.devices.find((d) => d.id === id);

describe('device catalog', () => {
  it('110kW power shelf draws its 6 PSUs in one row', () => {
    const psus = layoutFace(dev('power-shelf-mgx-110kw')!, 'rear').psus;
    expect(psus).toHaveLength(6);
    expect(new Set(psus.map((b) => b.y)).size).toBe(1);
  });
  it('64x1.6T switch: busbar-fed (no PSUs), mgmt + BMC + console RJ45 and a 100G QSFP28', () => {
    const d = dev('switch-64x1600g-osfp')!;
    expect(d.psus).toBeUndefined();
    expect(d.ports.filter((g) => g.formFactor === 'RJ45').map((g) => g.id).sort()).toEqual(['bmc', 'console', 'mgmt']);
    expect(d.ports.find((g) => g.formFactor === 'QSFP28')?.speedGbps).toBe(100);
  });
  it('every 64-port switch lays its data ports out in 4 rows', () => {
    const sw = SHIPPED_CATALOG.devices.filter((d) => d.category === 'switch').flatMap((d) => d.ports).filter((g) => g.role === 'data' && g.count === 64);
    expect(sw.length).toBeGreaterThan(0);
    expect(sw.every((g) => g.rows === 4)).toBe(true);
  });
  it('testers and console servers have their own categories; no power shelf controller', () => {
    for (const id of ['tester-4x1600g-osfp', 'tester-8x800g-osfp']) expect(dev(id)).toMatchObject({ category: 'tester', psus: { count: 3 } });
    expect(dev('console-server-48')?.category).toBe('console-server');
    expect(dev('power-shelf-controller-3u')).toBeUndefined();
  });
});
