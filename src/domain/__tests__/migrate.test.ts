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
  it('moves project DAC / AOC optics to cables and re-points port settings', () => {
    const p = normalizeProject({
      schema: 'dc-lab/project@1',
      optics: [
        { id: 'my-dac', name: 'My DAC', packaging: 'module', formFactor: 'OSFP', speedGbps: 800, reach: 'DAC', fiberConnector: '', reachM: 2, powerW: 0 },
        { id: 'my-aoc', name: 'My AOC', packaging: 'module', formFactor: 'QSFP-DD', speedGbps: 400, reach: 'AOC', fiberConnector: '', reachM: 30, powerW: 6 },
        { id: 'dr8', name: 'DR8', packaging: 'module', formFactor: 'OSFP', speedGbps: 800, reach: 'DR8', fiberConnector: 'MPO-16', reachM: 500, powerW: 15 },
      ],
      rackDesigns: [{ id: 'd', placements: [{ id: 'p', portSettings: { 'g/1': { mode: '1x800G', opticId: 'my-dac' } }, groupSettings: { g: { opticId: 'my-aoc' } } }] }],
    });
    expect(p.optics.map((o) => o.id)).toEqual(['dr8']);
    const dac = p.cableMedia.find((c) => c.id === 'my-dac')!;
    expect(dac.type).toBe('copper-dac');
    expect(dac.ends.a.connector).toBe('OSFP');
    expect(dac.speedGbps).toBe(800);
    expect(p.cableMedia.find((c) => c.id === 'my-aoc')).toMatchObject({ type: 'aoc', powerWPerEnd: 6 });
    expect(p.rackDesigns[0].placements[0].portSettings['g/1']).toEqual({ mode: '1x800G', reach: 'DAC', cableId: 'my-dac' });
    expect(p.rackDesigns[0].placements[0].groupSettings.g).toEqual({ reach: 'AOC', cableId: 'my-aoc' });
  });
  it('no built-in optic is a direct-attach cable', async () => {
    const { BUILTIN_CATALOG } = await import('../../catalog');
    expect(BUILTIN_CATALOG.optics.filter((o) => /^(DAC|AEC|AOC)$/i.test(o.reach))).toEqual([]);
  });
});
