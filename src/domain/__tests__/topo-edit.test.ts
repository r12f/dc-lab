import { describe, expect, it } from 'vitest';
import { parseYaml } from '../topo/yaml';
import { renameYamlKey, setYamlIn } from '../topo/yaml-edit';
import { addGroup, addLink, deleteGroup, deleteLink, linksOfGroup, newGroupName, newLinkName, renameGroup, renamePool, setDcId, setGroupField, setLinkField } from '../topo/edit';
import { parseVirtual } from '../topo/virtual';

const SRC = `topology: demo
version: 1

# groups
device_set_groups:
  server:
    role: OVL3 server   # the role
    count: 4
    partitions:
      - { key: pod, count: 2 }
      # second level
      - { key: pair, sizes: { "1": 3, "2": 1 } }
    ports:
      nic: p{1-2}        # both NICs

  tor:
    role: T0
    count: 2
    partitions: [ { key: pod, count: 2 } ]
    ports: { down: etp{1-4}{a,b}, up: etp{5-8} }

  flat: { role: x, count: 1, ports: { p: q{1-2} } }

topo:
  - name: server-tor             # each server to its pod's tor
    from: { group: server, key: "\${pod}", ports: nic }
    to:   { group: tor,    key: "\${pod}", ports: down }
    pattern: { type: mesh, per_pair: 1 }

  - { name: tor-flat, from: { group: tor, ports: up }, to: { group: flat, ports: p }, pattern: { type: mesh, per_pair: 1 } }

# 3. MAPPING
mapping:
  - group: server
    members: [ { select: { rack: "*" } } ]
`;

/** Lines that differ between two sources of the same length. */
const changed = (a: string, b: string) => {
  const x = a.split('\n'); const y = b.split('\n');
  return y.flatMap((l, i) => (l !== x[i] ? [l] : []));
};

describe('YAML edits in place', () => {
  it('reads the fixture as a valid topology', () => {
    expect(parseVirtual(SRC).problems).toEqual([]);
  });
  it('sets a scalar on its own line, keeping its comment and every other line', () => {
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'server', 'count'], 8))).toEqual(['    count: 8']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'server', 'role'], 'GPU server'))).toEqual(['    role: GPU server   # the role']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'server', 'ports', 'nic'], 'p{1-4}'))).toEqual(['      nic: p{1-4}        # both NICs']);
  });
  it('rewrites just the inline value a field sits in', () => {
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'server', 'partitions', 0, 'count'], 4)))
      .toEqual(['      - { key: pod, count: 4 }']);
    expect(changed(SRC, setYamlIn(SRC, ['topo', 0, 'to', 'group'], 'flat')))
      .toEqual(['    to:   { group: flat,    key: "${pod}", ports: down }']);
    expect(changed(SRC, setYamlIn(SRC, ['topo', 0, 'to', 'key'], '${pod}-x')))
      .toEqual(['    to:   { group: tor,    key: "${pod}-x", ports: down }']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'tor', 'ports', 'up'], 'etp{5-6}')))
      .toEqual(['    ports: { down: etp{1-4}{a,b}, up: etp{5-6} }']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'tor', 'ports', 'up'], 'a, b')))
      .toEqual(['    ports: { down: etp{1-4}{a,b}, up: "a, b" }']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'tor', 'ports', 'mgmt'], 'eth0')))
      .toEqual(['    ports: { down: etp{1-4}{a,b}, up: etp{5-8}, mgmt: eth0 }']);
    expect(changed(SRC, setYamlIn(SRC, ['device_set_groups', 'tor', 'ports', 'down'], undefined)))
      .toEqual(['    ports: { up: etp{5-8} }']);
    expect(changed(SRC, setYamlIn(SRC, ['topo', 1, 'pattern', 'per_pair'], 2)))
      .toEqual(['  - { name: tor-flat, from: { group: tor, ports: up }, to: { group: flat, ports: p }, pattern: { type: mesh, per_pair: 2 } }']);
  });
  it('inserts a missing key where its order puts it; removing it restores the file', () => {
    const typed = setGroupField(SRC, 'tor', ['device_type'], 'switch-64x800g-osfp');
    const lines = typed.split('\n');
    expect(lines[lines.indexOf('    device_type: switch-64x800g-osfp') + 1]).toBe('    ports: { down: etp{1-4}{a,b}, up: etp{5-8} }');
    expect(setGroupField(typed, 'tor', ['device_type'], undefined)).toBe(SRC);
    const order = { order: ['role', 'count', 'partitions', 'spares', 'ports'] };
    const listed = setYamlIn(SRC, ['device_set_groups', 'server', 'spares'], [{ ports: 'p{3-4}', why: 'x' }], order);
    expect(listed).toContain('    spares:\n      - { ports: "p{3-4}", why: x }\n    ports:\n');
    expect(setYamlIn(listed, ['device_set_groups', 'server', 'spares'], undefined)).toBe(SRC);
    // A pool given its optic becomes a map on its line, keeping the comment; or, asked, a block under its key.
    expect(changed(SRC, setGroupField(SRC, 'server', ['ports', 'nic'], { ports: 'p{1-2}', optic: 'o1' })))
      .toEqual(['      nic: { ports: "p{1-2}", optic: o1 }        # both NICs']);
    const block = setGroupField(SRC, 'server', ['ports', 'nic'], { ports: 'p{1-2}', optic: 'o1' }, { block: true });
    expect(block).toContain('    ports:\n      nic:               # both NICs\n        ports: p{1-2}\n        optic: o1\n\n  tor:');
    expect(setGroupField(block, 'server', ['ports', 'nic'], 'p{1-2}')).toBe(SRC.replace('      nic: p{1-2}        # both NICs', '      nic: p{1-2}'));
  });
  it('appends and removes list items; a list emptied stays a list', () => {
    const more = setGroupField(SRC, 'server', ['partitions', 2], { key: 'x', count: 1 });
    expect(more).toContain('      - { key: pair, sizes: { "1": 3, "2": 1 } }\n      - { key: x, count: 1 }\n');
    expect(setGroupField(more, 'server', ['partitions', 2], undefined)).toBe(SRC);
    const none = deleteLink(deleteLink(SRC, 1), 0);
    expect((parseYaml(none) as { topo: unknown }).topo).toEqual([]);
    expect(none).toContain('topo: []\n\n# 3. MAPPING');
  });
  it('renames keys, in blocks and inside flow maps', () => {
    expect(changed(SRC, renameYamlKey(SRC, ['device_set_groups', 'tor'], 'leaf'))).toEqual(['  leaf:']);
    expect(changed(SRC, renameYamlKey(SRC, ['device_set_groups', 'tor', 'ports', 'up'], 'uplink')))
      .toEqual(['    ports: { down: etp{1-4}{a,b}, uplink: etp{5-8} }']);
  });
  it('keeps CRLF line ends', () => {
    const crlf = SRC.replace(/\n/g, '\r\n');
    const out = setYamlIn(crlf, ['device_set_groups', 'server', 'count'], 8);
    expect(out).toBe(crlf.replace('    count: 4', '    count: 8'));
  });
});

describe('topology edits', () => {
  it('renames a group with the link ends and mapping entries naming it', () => {
    const out = renameGroup(SRC, 'tor', 'leaf');
    const d = parseYaml(out) as { topo: { from: { group: string }; to: { group: string } }[] };
    expect([d.topo[0].to.group, d.topo[1].from.group]).toEqual(['leaf', 'leaf']);
    expect(parseVirtual(out).problems).toEqual([]);
    expect(renameGroup(SRC, 'server', 'gpu')).toContain('mapping:\n  - group: gpu\n');
  });
  it('renames a pool with the link ends using it', () => {
    const out = renamePool(SRC, 'server', 'nic', 'eth');
    expect(changed(SRC, out)).toEqual(['      eth: p{1-2}        # both NICs', '    from: { group: server, key: "${pod}", ports: eth }']);
    expect(parseVirtual(out).problems).toEqual([]);
  });
  it('deletes a group with its links and mapping entries', () => {
    expect(linksOfGroup(SRC, 'tor')).toEqual([0, 1]);
    const out = deleteGroup(SRC, 'server');
    const d = parseYaml(out) as { device_set_groups: object; topo: unknown[]; mapping: unknown[] };
    expect([Object.keys(d.device_set_groups), d.topo.length, d.mapping]).toEqual([['tor', 'flat'], 1, []]);
  });
  it('adds groups and links in the file\'s style, creating their sections when missing', () => {
    const name = newGroupName(SRC);
    const g = addGroup(SRC, name, { role: 'x', count: 2, ports: { p: 'p{1-4}' } });
    expect(g).toContain('  flat: { role: x, count: 1, ports: { p: q{1-2} } }\n\n  group:\n    role: x\n    count: 2\n    ports:\n      p: p{1-4}\n\ntopo:');
    const link = { name: newLinkName(SRC), from: { group: 'server', ports: 'nic' }, to: { group: 'flat', ports: 'p' }, pattern: { type: 'mesh', per_pair: 1 } };
    const l = addLink(SRC, link);
    expect(l.index).toBe(2);
    expect(l.source).toContain('per_pair: 1 } }\n\n  - name: link\n    from: { group: server, ports: nic }\n    to: { group: flat, ports: p }\n    pattern: { type: mesh, per_pair: 1 }\n\n# 3. MAPPING');
    expect((parseYaml(l.source) as { topo: unknown[] }).topo[2]).toEqual(link);
    // An empty file gets both sections.
    const fresh = addLink(addGroup('topology: t\n', 'a', { role: 'r', count: 1, ports: { p: 'p1' } }), { ...link, from: { group: 'a', ports: 'p' }, to: { group: 'a', ports: 'p' } }).source;
    expect(fresh).toBe('topology: t\ndevice_set_groups:\n  a:\n    role: r\n    count: 1\n    ports:\n      p: p1\ntopo:\n  - name: link\n    from: { group: a, ports: p }\n    to: { group: a, ports: p }\n    pattern: { type: mesh, per_pair: 1 }\n');
  });
  it('sets link fields, dc.id, id_format, and collapses pools back to plain ports when optic is cleared', () => {
    expect(changed(SRC, setLinkField(SRC, 0, ['pattern', 'type'], 'round-robin'))).toEqual(['    pattern: { type: round-robin, per_pair: 1 }']);
    expect(changed(SRC, setLinkField(SRC, 0, ['name'], 'st'))).toEqual(['  - name: st             # each server to its pod\'s tor']);

    // Link `cable` inserts after `pattern`/`map` in block and inline links, and removes cleanly.
    const cabled0 = setLinkField(SRC, 0, ['cable'], 'mpo12-smf');
    expect(cabled0).toContain('    pattern: { type: mesh, per_pair: 1 }\n    cable: mpo12-smf\n');
    expect(setLinkField(cabled0, 0, ['cable'], undefined)).toBe(SRC);
    const cabled1 = setLinkField(SRC, 1, ['cable'], 'dac-800g');
    expect(changed(SRC, cabled1)).toEqual([
      '  - { name: tor-flat, from: { group: tor, ports: up }, to: { group: flat, ports: p }, pattern: { type: mesh, per_pair: 1 }, cable: dac-800g }',
    ]);

    // Top-level `dc.id` inserts between `version` and `device_set_groups`, updates in place, and removes `dc` when cleared.
    const withDc = setDcId(SRC, 'us-west-2');
    expect(parseVirtual(withDc).dc).toEqual({ id: 'us-west-2' });
    expect(withDc.indexOf('dc:')).toBeGreaterThan(withDc.indexOf('version: 1'));
    expect(withDc.indexOf('dc:')).toBeLessThan(withDc.indexOf('device_set_groups:'));
    expect(parseVirtual(setDcId(withDc, 'eu-central-1')).dc).toEqual({ id: 'eu-central-1' });
    expect(setDcId(withDc, '')).toBe(SRC);
    expect(setDcId(withDc, undefined)).toBe(SRC);

    // Group `id_format` inserts in GROUP_KEYS order (`count` -> `id_format` -> `partitions`) and clears cleanly.
    const withFmt = setGroupField(SRC, 'server', ['id_format'], '{dc.id}-{group.role}-{device.index:2}');
    expect(parseVirtual(withFmt).groups[0].idFormat).toBe('{dc.id}-{group.role}-{device.index:2}');
    expect(setGroupField(withFmt, 'server', ['id_format'], undefined)).toBe(SRC);

    // Clearing `['ports', pool, 'optic']` collapses `{ ports: X, optic: o1 }` back to `X`.
    const withOptic = setGroupField(SRC, 'server', ['ports', 'nic'], { ports: 'p{1-2}', optic: 'o1' });
    expect(setGroupField(withOptic, 'server', ['ports', 'nic', 'optic'], undefined)).toBe(SRC);
  });
});
