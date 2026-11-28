import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { modesOf } from '../device/breakout';

describe('100G QSFP28 breakout', () => {
  it('every built-in 100G QSFP28 port offers 1x100G, 2x50G, 4x25G and 4x10G', () => {
    const groups = SHIPPED_CATALOG.devices.flatMap((d) => d.ports.filter((g) => g.formFactor === 'QSFP28' && g.speedGbps === 100).map((g) => [d.id, g] as const));
    expect(groups.length).toBeGreaterThan(0);
    for (const [id, g] of groups) expect(modesOf(g).slice(0, 4), id).toEqual(['1x100G', '2x50G', '4x25G', '4x10G']);
  });
  it('64x800G OSFP switch has two SFP28 service ports', () => {
    const g = SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x800g-osfp')!.ports.find((x) => x.formFactor === 'SFP28')!;
    expect([g.role, g.count, g.speedGbps]).toEqual(['service', 2, 25]);
  });
});

describe('64x800G OSFP switch: 2-PSU and 4-PSU item types', () => {
  it('same switch, differing only in PSU count and PSU weight', () => {
    const two = SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x800g-osfp')!;
    const four = SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x800g-osfp-4psu')!;
    expect([two.name, two.psus?.count, four.name, four.psus?.count]).toEqual(['64x800G OSFP Switch (2PSU)', 2, '64x800G OSFP Switch (4PSU)', 4]);
    expect(four.weightKg).toBeGreaterThan(two.weightKg);
    expect({ ...four, id: two.id, name: two.name, psus: two.psus, weightKg: two.weightKg }).toEqual(two);
  });
});
