import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { dataBandwidthGbps, deviceSortKey } from '../device/ports';

describe('switch order', () => {
  it('switches sort by data bandwidth, highest first', () => {
    const sw = BUILTIN_CATALOG_FOR_TESTS.devices.filter((d) => d.category === 'switch');
    const sorted = [...sw].sort((a, b) => deviceSortKey(a)! - deviceSortKey(b)! || a.name.localeCompare(b.name));
    const bw = sorted.map(dataBandwidthGbps);
    expect(bw).toEqual([...bw].sort((a, b) => b - a));
    expect(sorted[0].id).toBe('switch-cpo-128x800g-mpo');
    expect(dataBandwidthGbps(sorted[0])).toBe(102400);
  });
  it('mgmt/service ports do not count; non-switches have no key', () => {
    const osfp = BUILTIN_CATALOG_FOR_TESTS.devices.find((d) => d.id === 'switch-64x800g-osfp')!;
    expect(dataBandwidthGbps(osfp)).toBe(51200);
    expect(deviceSortKey(BUILTIN_CATALOG_FOR_TESTS.devices.find((d) => d.category === 'server')!)).toBeUndefined();
  });
});
