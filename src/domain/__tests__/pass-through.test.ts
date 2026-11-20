import { describe, expect, it } from 'vitest';
import { passThroughPeer, withPassThrough, withoutPassThroughTwins } from '../device/ports';
import { migrateDevice } from '../project/migrate';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import type { DeviceDefinition } from '../device/types';

const lib = new Library(SHIPPED_CATALOG, emptyProject());

describe('pass-through port groups', () => {
  it('every built-in patch panel stores only its front groups, each marked pass-through', () => {
    for (const d of SHIPPED_CATALOG.devices.filter((x) => x.category === 'patch-panel' && x.ports.length)) {
      expect(d.ports.every((g) => g.face === 'front' && g.passThrough), d.id).toBe(true);
    }
  });
  it('the library derives the rear twin: same id as before, mirrored, rear cable gender', () => {
    const d = lib.devices.get('fiber-housing-80xmmc16')!;
    const rm1 = d.ports.find((g) => g.id === 'rm1')!;
    const fm1 = d.ports.find((g) => g.id === 'fm1')!;
    expect(rm1).toMatchObject({ face: 'rear', rightToLeft: true, cableGender: 'female', passThroughOf: 'fm1', count: fm1.count, portNumbers: fm1.portNumbers, label: 'Rear M1 1-10' });
    expect(passThroughPeer(d, 'fm1/7')).toBe('rm1/7');
    expect(passThroughPeer(d, 'rm1/7')).toBe('fm1/7');
    expect(withPassThrough(d)).toBe(d);
    expect(withoutPassThroughTwins(d).ports.some((g) => g.passThroughOf)).toBe(false);
  });
  it('an old project panel with front + rear copies migrates to front pass-through groups (rear refs unchanged)', () => {
    const grp = (id: string, face: string, gender: string) => ({ id, label: id, role: 'data', formFactor: 'MPO-8', count: 6, speedGbps: 0, lanes: 8, face, rows: 1, breakoutModes: [], cableGender: gender });
    const old = { id: 'pp', name: 'PP', category: 'patch-panel', ports: [grp('f1', 'front', 'female'), grp('f2', 'front', 'female'), grp('r1', 'rear', 'male'), grp('r2', 'rear', 'male')], breakoutProfiles: [] };
    const m = migrateDevice(old) as unknown as DeviceDefinition;
    expect(m.ports.map((g) => [g.id, g.passThrough?.rearId, g.passThrough?.rearCableGender])).toEqual([['f1', 'r1', 'male'], ['f2', 'r2', 'male']]);
    const shown = withPassThrough(m);
    expect(shown.ports.filter((g) => g.face === 'rear').map((g) => g.id)).toEqual(['r1', 'r2']);
    // Panels whose faces differ are left as they are.
    const odd = { ...old, ports: [grp('f1', 'front', 'female'), { ...grp('r1', 'rear', 'male'), count: 4 }] };
    expect((migrateDevice(odd) as unknown as DeviceDefinition).ports.some((g) => g.passThrough)).toBe(false);
  });
});
