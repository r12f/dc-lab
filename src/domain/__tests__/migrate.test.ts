import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../project/serializer';
import { parseVirtual } from '../topo/virtual';

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
  it('migrates legacy pool-level cable definitions in topologies[].source onto topo links and collapses plain pools', () => {
    const legacySource = `topology: legacy
version: 1
device_set_groups:
  s:
    role: server
    count: 4
    ports:
      nic: { ports: "fe{1-2}", optic: qsfp112-400g-dr4, cable: mpo12-smf }
      dac_p:
        ports: p{1-2}
        cable: dac-800g
  t:
    role: tor
    count: 2
    ports:
      down: { ports: "etp{1-4}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
      dac_q: { ports: "etp{5-8}" }
      conflict_a: { ports: "etp9", cable: dac-800g }
  u:
    role: peer
    count: 1
    ports:
      conflict_b: { ports: "etp{1-2}", cable: aoc-800g }
topo:
  - name: s-t
    from: { group: s, ports: nic }
    to:   { group: t, ports: down }
    pattern: { type: mesh, per_pair: 1 }
  - { name: one-sided, from: { group: s, ports: dac_p }, to: { group: t, ports: dac_q }, pattern: { type: mesh, per_pair: 1 } }
  - { name: conflicting, from: { group: t, ports: conflict_a }, to: { group: u, ports: conflict_b }, pattern: { type: mesh, per_pair: 1 } }
`;
    const p = normalizeProject({
      schema: 'dc-lab/project@1',
      topologies: [{ id: 't1', name: 'Legacy', source: legacySource }],
    });
    const migrated = p.topologies[0].source;
    const v = parseVirtual(migrated);
    expect(v.problems).toEqual([]);
    expect(v.links.map((l) => [l.name, l.cable])).toEqual([
      ['s-t', 'mpo12-smf'],
      ['one-sided', 'dac-800g'],
      ['conflicting', undefined],
    ]);
    // `{ ports: p{1-2}, cable: dac-800g }` collapsed back to `dac_p: p{1-2}`, while `{ ports, optic, cable }` kept `{ ports, optic }`.
    expect(migrated).toContain('dac_p: p{1-2}');
    expect(migrated).toContain('conflict_a: etp9');
    expect(migrated).toContain('nic: { ports: "fe{1-2}", optic: qsfp112-400g-dr4 }');
  });
});
