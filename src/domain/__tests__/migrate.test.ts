import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../project/serializer';

describe('project migration', () => {
  it('upgrades string profile settings, roles and placement configs', () => {
    const p = normalizeProject({
      schema: 'dc-lab/project@1',
      devices: [{ id: 'x', ports: [{ id: 'mgmt', label: 'MGMT', connector: 'RJ45' }],
        breakoutProfiles: [{ id: 'a', groupDefaults: { g: '2x400G' }, overrides: { 'g/1': '4x200G' } }] }],
      rackDesigns: [{ id: 'd', placements: [{ id: 'p', portConfig: { 'g/1': { breakout: '2x400G', opticId: 'o' } }, groupOptics: { g: 'o2' } }] }],
    });
    expect(p.devices[0].ports[0].role).toBe('mgmt');
    expect(p.devices[0].breakoutProfiles[0].groupDefaults.g).toEqual({ mode: '2x400G' });
    expect(p.rackDesigns[0].placements[0].portSettings['g/1']).toEqual({ mode: '2x400G', opticId: 'o' });
    expect(p.rackDesigns[0].placements[0].groupSettings.g).toEqual({ opticId: 'o2' });
    expect(p.hiddenBuiltins).toEqual([]);
  });
});
