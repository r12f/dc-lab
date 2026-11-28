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
  it('1RU fiber housing support: no ports', () => {
    expect(dev('fiber-housing-support-1ru')).toMatchObject({ height: { units: 1 }, ports: [] });
  });
  it('110kW power shelf is 3RU', () => {
    expect(dev('power-shelf-mgx-110kw')?.height.units).toBe(3);
  });
  it('MGX GPU compute & scale-up switch trays: backend before frontend, compact RJ45 control/sensor ports; leak tray has no ports', () => {
    expect(dev('gpu-tray-1ru-lc')).toBeUndefined();
    const g = dev('gpu-tray-1ru-lc-4x1600g')!;
    expect(g.height.units).toBe(1);
    expect(g.ports.map((p) => [p.id, p.role, p.count, p.speedGbps])).toEqual([
      ['be', 'data', 4, 1600],
      ['fe', 'data', 2, 400],
      ['bmc', 'mgmt', 2, 1],
      ['lom', 'mgmt', 1, 1],
    ]);
    const sw = dev('scaleup-switch-tray-1ru-lc')!;
    expect(sw.ports.map((p) => [p.id, p.role, p.count, p.speedGbps])).toEqual([
      ['console', 'console', 1, 0],
      ['bmc', 'mgmt', 1, 1],
      ['mgmt', 'mgmt', 2, 1],
      ['leak', 'console', 1, 0],
    ]);
    expect(dev('leak-tray')?.ports).toEqual([]);
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
  it('CDUs have their own category: in-rack 7kW and an in-row sidecar that fills a rack', () => {
    expect(SHIPPED_CATALOG.devices.filter((d) => d.category === 'cdu').map((d) => d.id).sort()).toEqual(['cdu-in-rack-7kw', 'cdu-in-row-sidecar-110kw']);
    expect(dev('cdu-in-row-sidecar-110kw')!.height).toEqual({ units: 48, system: 'RU' });
  });
});
