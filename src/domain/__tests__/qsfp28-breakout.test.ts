import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { modesOf } from '../device/breakout';

describe('100G QSFP28 breakout', () => {
  it('every built-in 100G QSFP28 port offers 1x100G, 2x50G, 4x25G and 4x10G', () => {
    const groups = SHIPPED_CATALOG.devices.flatMap((d) => d.ports.filter((g) => g.formFactor === 'QSFP28' && g.speedGbps === 100).map((g) => [d.id, g] as const));
    expect(groups.length).toBeGreaterThan(0);
    for (const [id, g] of groups) expect(modesOf(g).slice(0, 4), id).toEqual(['1x100G', '2x50G', '4x25G', '4x10G']);
  });
});
