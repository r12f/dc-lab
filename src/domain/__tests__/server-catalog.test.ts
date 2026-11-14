import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { findProfile } from '../device/breakout';
import { resolvePort } from '../device/port-settings';

describe('2U Server', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());
  const s = lib.devices.get('server-2u-2s')!;
  it('is named by size only and has one rear QSFP28 data port (100G DR4 by default)', () => {
    expect(s.name).toBe('2U Server');
    const g = s.ports.find((x) => x.formFactor === 'QSFP28')!;
    expect([g.role, g.face, g.count, g.speedGbps]).toEqual(['data', 'rear', 1, 100]);
    const r = resolvePort(lib, s, `${g.id}/1`, findProfile(s))!;
    expect([r.mode, r.optic?.fiberConnector]).toEqual(['1x100G', 'MPO-12']);
  });
});
