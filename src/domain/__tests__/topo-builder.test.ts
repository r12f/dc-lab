import { describe, expect, it } from 'vitest';
import { parseYaml, YamlError } from '../topo/yaml';
import { expandPorts, parseVirtual, poolPorts, type VirtualTopo } from '../topo/virtual';
import { DEFAULT_OPTIONS, groupDevices, layoutDiagram, type GroupBox } from '../topo/diagram';
import { pick, sliceTopo, withGaps } from '../topo/slice';
import { portLayout, portUse } from '../topo/ports';
import { ruleText } from '../topo/rule';
import { estimateTopoBom, topoBomColumns } from '../topo/bom';
import { hardwareProblems, topoHardware } from '../topo/hardware';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import { normalizeProject, serializeProject } from '../project/serializer';
import { emptyProject } from '../project/types';
import { Library } from '../library/library';
import type { ItemVariant } from '../items/types';
import type { BreakoutProfile, PortSetting } from '../device/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';

describe('topology YAML reader', () => {
  it('reads block maps, lists, flow collections and comments', () => {
    const v = parseYaml(`a: 1   # one
b:
  - { x: "\${su}", y: [1, "2"] }
  - name: n
    k: v
c: [p{1-4},
    q]
`);
    expect(v).toEqual({ a: 1, b: [{ x: '${su}', y: [1, '2'] }, { name: 'n', k: 'v' }], c: ['p{1-4}', 'q'] });
  });
  it('reports the line of an error', () => {
    expect(() => parseYaml('a: 1\n  b: 2\n')).toThrow(YamlError);
    try { parseYaml('a: 1\nb: { x: 1\n'); } catch (e) { expect((e as YamlError).line).toBe(2); }
  });
});

describe('port pools', () => {
  it('expands braces left to right, keeps zero padding, nested lists in order', () => {
    expect(expandPorts('etp{1-2}{a-c}')).toEqual(['etp1a', 'etp1b', 'etp1c', 'etp2a', 'etp2b', 'etp2c']);
    expect(expandPorts('E5/{1,7}/1')).toEqual(['E5/1/1', 'E5/7/1']);
    expect(expandPorts('p{01-03}')).toEqual(['p01', 'p02', 'p03']);
    expect(poolPorts([['a{1-2}', 'b'], 'c'])).toEqual(['a1', 'a2', 'b', 'c']);
  });
});

describe('virtual topology', () => {
  const v = parseVirtual(SAMPLE_TOPOLOGY);
  it('parses the sample with no problems', () => {
    expect(v.problems).toEqual([]);
    expect(v.groups.map((g) => `${g.name}:${g.count}`)).toEqual(['server:64', 't0:32', 't1:16', 't2:8']);
    expect(v.groups.find((g) => g.name === 't0')?.pools).toEqual({ down: 16, up: 8 });
  });
  it('counts the links each spec generates', () => {
    const n = Object.fromEntries(v.links.map((l) => [l.name, l.links]));
    // 4 su x 16 servers x 8 T0; 4 T1 planes x (2 x 4 T0) x 4 T1; 16 T1 x 2 per pair.
    expect(n).toEqual({ 'server-t0': 512, 't0-t1': 128, 't1-t2': 32 });
  });
  it('reports undefined groups, pools, keys and partition sizes', () => {
    const bad = parseVirtual(`device_set_groups:
  a: { role: x, count: 10, partitions: [ { key: k, count: 3, size: 3 } ], ports: { p: e{1-4} } }
topo:
  - name: l
    from: { group: a, key: "\${z}", ports: q }
    to:   { group: b, ports: p }
    map: [ { from: [1], to: "1" } ]
    pattern: { type: star }
`).problems.map((p) => p.message);
    expect(bad).toEqual(expect.arrayContaining([
      'group a: partition k is 3 x 3 = 9, count is 10',
      'l: from group a has no port pool "q"',
      'l: from key uses ${z}, not a partition key of a',
      'l: to group "b" is not defined',
      'l: pattern type must be mesh or round-robin',
      'l: map values must be strings ("1", not 1)',
    ]));
  });
  it('sizes ports per device by the largest of uneven sets', () => {
    const u = parseVirtual(`device_set_groups:
  s: { role: x, count: 72, partitions: [ { key: p, sizes: { "1": 54, "2": 18 } } ], ports: { n: e{1-2} } }
  t: { role: y, count: 4, partitions: [ { key: p, count: 2, size: 2 } ], ports: { d: e{1-60} } }
topo:
  - { name: l, from: { group: s, key: "\${p}", ports: n }, to: { group: t, key: "\${p}", ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(u.problems).toEqual([]);
    expect(u.links[0].toPorts).toBe(54);
  });
  it('flags a pool too small for the pattern', () => {
    const p = parseVirtual(`device_set_groups:
  a: { role: x, count: 4, ports: { p: e{1-2} } }
  b: { role: y, count: 3, ports: { p: e{1-8} } }
topo:
  - { name: l, from: { group: a, ports: p }, to: { group: b, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`).problems.map((x) => x.message);
    expect(p).toEqual(['l: each a device needs 3 ports, pool p has 2']);
  });
});

describe('slice', () => {
  it('picks first, second and last, and marks the gaps', () => {
    expect(pick(['1', '2', '3', '4'])).toEqual(['1', '2', '4']);
    expect(pick(['1', '2'])).toEqual(['1', '2']);
    expect(withGaps(['1', '2', '4'], ['1', '2', '3', '4'])).toEqual(['1', '2', null, '4']);
    expect(withGaps(['2', '3'], ['1', '2', '3', '4'])).toEqual([null, '2', '3', null]);
  });
  it('follows a map: first, second, last targets, each with its mapped sources in map order', () => {
    const v = parseVirtual(SAMPLE_TOPOLOGY);
    const s = sliceTopo(v, new Map([['server', ['su']], ['t0', ['plane', 'su']], ['t1', ['plane']], ['t2', ['plane']]]));
    expect(s.get('t1')!.get('plane')!.values).toEqual(['1', '2', '4']);
    expect(s.get('t0')!.get('plane')!.values).toEqual(['1', '5', '2', '6', '4', '8']);
    expect(s.get('t0')!.get('plane')!.order).toEqual(['1', '5', '2', '6', '3', '7', '4', '8']);
    // server-t0 by su, no map: the same su values on both ends.
    expect(s.get('server')!.get('su')!.values).toEqual(['1', '2', '4']);
    expect(s.get('t0')!.get('su')!.values).toEqual(['1', '2', '4']);
  });
});

describe('ports', () => {
  const v = parseVirtual(SAMPLE_TOPOLOGY);
  const t0 = v.groups.find((g) => g.name === 't0')!;
  it('lays out every port of a device: a column per number, a row per lane, the full cage', () => {
    const l = portLayout(t0);
    expect(l.cols).toEqual(['etp1', 'etp2', 'etp3', 'etp4', 'etp5', 'etp6', 'etp7', 'etp8', 'etp9', 'etp10']);
    expect(l.rows).toEqual(['a', 'b', 'c', 'd']);
    expect(l.cells).toHaveLength(40);
    expect(l.cells.find((c) => c.port === 'etp10c')).toEqual({ port: 'etp10c', col: 9, row: 2 });
    // No lane suffix: rows of 64 in pool order.
    const server = portLayout(v.groups.find((g) => g.name === 'server')!);
    expect([server.cols.length, server.rows.length]).toEqual([8, 1]);
  });
  it('fills each pool in order, link specs in topo order', () => {
    const u = portUse(t0, v);
    expect(u.used.get('down')).toBe(16);
    expect(u.used.get('up')).toBe(4);
    expect(['etp9a', 'etp9b', 'etp9c', 'etp9d', 'etp10a'].map((p) => u.owner.get(p))).toEqual([1, 1, 1, 1, undefined]);
  });
});

describe('rule text', () => {
  it('states pairing, pattern, devices per pair and ports per device', () => {
    const v = parseVirtual(SAMPLE_TOPOLOGY);
    const r = Object.fromEntries(v.links.map((l) => [l.name, ruleText(l)]));
    expect(r['t0-t1']).toEqual(['t0-t1 · 128 links', '2 t0 planes → 1 t1 plane (map) · mesh 4 x 4 per pair · each t0 4 up · each t1 8 down']);
    expect(r['server-t0'][1]).toBe('server su k → t0 su k · mesh 16 x 8 per pair · each server 8 nic · each t0 16 down');
    expect(r['t1-t2'][1]).toMatch(/^each t1 plane → all t2 plane\.index 1-3 · round-robin/);
  });
});

describe('diagram', () => {
  const v = parseVirtual(SAMPLE_TOPOLOGY);
  const d = layoutDiagram(v);
  const box = (n: string, dd = d) => dd.boxes.find((b) => b.group.name === n)!;
  const sets = (b: GroupBox) => b.body.sets.map((s) => s.label.split(' · ')[0]);
  const labels = (b: GroupBox) => groupDevices(b).map((x) => x.label);
  it('stacks tiers bottom-up from the link direction', () => {
    expect(box('server').y).toBeGreaterThan(box('t0').y);
    expect(box('t0').y).toBeGreaterThan(box('t1').y);
    expect(box('t1').y).toBeGreaterThan(box('t2').y);
    expect(d.rules).toHaveLength(3);
    // Rules sharing a tier gap do not overlap.
    const ys = d.rules.map((r) => r.y);
    expect(new Set(ys).size).toBe(ys.length);
  });
  it('splits a group by the mapped key, then the key it is reached by; three values at most', () => {
    expect(box('t0').nesting).toEqual(['plane', 'su']);
    expect(sets(box('t1'))).toEqual(['plane 1', 'plane 2', 'plane 4']);
    expect(box('t1').body.ellipses).toHaveLength(1);
    expect(sets(box('t0'))).toEqual(['plane 1', 'plane 5', 'plane 2', 'plane 6', 'plane 4', 'plane 8']);
    // One device per su inside a t0 plane, labelled by su; 16 servers per su labelled 1, 2, ..., 16.
    expect(labels(box('t0')).slice(0, 3)).toEqual(['1', '2', '4']);
    expect(sets(box('server'))).toEqual(['su 1', 'su 2', 'su 4']);
    expect(labels(box('server')).slice(0, 3)).toEqual(['1', '2', '16']);
  });
  it('draws device-to-device lines following the key, the map and the pattern', () => {
    const n = (li: number) => d.lines.filter((p) => p.link === li).length;
    // server-t0: per drawn su, 3 servers x 6 drawn t0 devices; t0-t1 mesh: per t1 plane, 6 t0 x 3 t1.
    expect(n(0)).toBe(54);
    expect(n(1)).toBe(54);
    // t1-t2 round-robin: each drawn t1 device to one t2 device, t2 1-3 of a plane only.
    const t12 = d.lines.filter((p) => p.link === 2);
    expect(t12).toHaveLength(9);
    const t2 = groupDevices(box('t2'));
    expect(t12.every((p) => Number(t2.find((x) => Math.abs(x.x + x.w / 2 - p.to[0]) < 1)!.label) <= 3)).toBe(true);
  });
  it('draws the port grids: up pools above the sets, down pools below, same columns', () => {
    const t0 = box('t0');
    const top = t0.grids.find((q) => q.side === 'top')!; const bottom = t0.grids.find((q) => q.side === 'bottom')!;
    expect(top.cols).toEqual(bottom.cols);
    expect(top.x).toBe(bottom.x);
    expect(top.y).toBeLessThan(t0.body.y);
    expect(bottom.y).toBeGreaterThan(t0.body.y);
    expect(top.pools).toEqual([{ name: 'up', ports: 8, used: 4, slots: 1 }]);
    expect(bottom.pools).toEqual([{ name: 'down', ports: 16, used: 16, slots: 2 }]);
    // Each edge marks its own pool; the other edge's ports are 'other'.
    expect(top.cells.find((c) => c.port === 'etp1a')).toMatchObject({ other: 'down', otherUsed: true });
    // Free up ports show as unused on the bottom edge too.
    expect(bottom.cells.find((c) => c.port === 'etp10a')).toMatchObject({ other: 'up', otherUsed: false });
    expect(top.cells.find((c) => c.port === 'etp9a')).toMatchObject({ pool: 'up', link: 1 });
  });
  it('moves a box by its saved offset and grows the drawing to hold it', () => {
    const m = layoutDiagram(v, DEFAULT_OPTIONS, { offsets: { t2: { dx: 400, dy: 30 } } });
    expect(box('t2', m).x).toBe(box('t2').x + 400);
    expect(box('t2', m).y).toBe(box('t2').y + 30);
    expect(m.width).toBeGreaterThanOrEqual(box('t2', m).x + box('t2', m).w);
    // Lines follow: t1-t2 lines end on the moved t2 devices.
    const t2 = groupDevices(box('t2', m));
    expect(m.lines.filter((p) => p.link === 2).every((p) => t2.some((x) => Math.abs(x.x + x.w / 2 - p.to[0]) < 1))).toBe(true);
    // Never past the top-left corner.
    expect(box('t2', layoutDiagram(v, DEFAULT_OPTIONS, { offsets: { t2: { dx: -9999, dy: -9999 } } })).x).toBe(4);
  });
  it('collapses a box to its header; its links become one line per spec to the box edge', () => {
    const c = layoutDiagram(v, DEFAULT_OPTIONS, { collapsed: ['t1'] });
    const t1 = box('t1', c);
    expect(t1.collapsed).toBe(true);
    expect([t1.grids, groupDevices(t1)]).toEqual([[], []]);
    expect(t1.h).toBeLessThan(box('t1').h);
    const touching = c.lines.filter((p) => p.link === 1 || p.link === 2);
    expect(touching).toHaveLength(2);
    expect(touching.every((p) => p.bundle)).toBe(true);
    // Lines not touching it stay device to device.
    expect(c.lines.filter((p) => p.link === 0).every((p) => !p.bundle)).toBe(true);
  });
  it('lets the split be chosen per group, and the port grids hidden', () => {
    const e = layoutDiagram(v, { partition: { t0: 'su>plane', server: '' }, ports: false });
    expect(sets(box('t0', e))).toEqual(['su 1', 'su 2', 'su 4']);
    expect(box('t0', e).grids).toEqual([]);
    expect(box('server', e).nesting).toEqual([]);
    expect(labels(box('server', e))).toEqual(['1', '2', '64']);
  });
});

describe('device type and port map: the breakout profile is matched to the ports', () => {
  // Test-local item (made-up vendor, model and power) and breakout profiles.
  const sw: ItemVariant = { id: 'sw-x', name: 'SW', target: 'device', itemId: 'switch-64x800g-osfp', vendor: 'V', model: 'SW', properties: {}, specs: { typicalW: 100 } };
  const profile = (id: string, name: string, groupDefaults: Record<string, PortSetting>, overrides: Record<string, PortSetting> = {}): BreakoutProfile =>
    ({ id, name, groupDefaults, overrides });
  const O = 'osfp-800g-2xdr4-ihs';
  const cages = (from: number, to: number, s: PortSetting) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`osfp/${from + i}`, s]));
  const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [sw] }, [], {}, {
    'switch-64x800g-osfp': { defaultProfileId: 'default', breakoutProfiles: [
      profile('default', 'Default', {}),
      profile('w2', 'All 2x400G', { osfp: { mode: '2x400G', opticId: O } }),
      profile('w8', 'All 8x100G', { osfp: { mode: '8x100G', opticId: O } }),
      profile('n800', 'All 1x800G', { osfp: { opticId: O } }),
      profile('u2', 'Uplinks 2x400G', {}, cages(5, 8, { mode: '2x400G', opticId: O })),
      profile('d4', 'Down 4x200G, up 2x400G', {}, { ...cages(1, 4, { mode: '4x200G', opticId: O }), ...cages(5, 8, { mode: '2x400G', opticId: O }) }),
    ] },
    'server-gpu-8u': { defaultProfileId: 'default', breakoutProfiles: [
      profile('default', 'Default', {}),
      profile('s4', 'All 4x100G', { fe: { mode: '4x100G', opticId: 'qsfp112-400g-dr4' } }),
      profile('s1', 'All 1x200G', { fe: { mode: '1x200G', opticId: 'qsfp112-400g-dr4' } }),
    ] },
  });
  const swName = lib.devices.get('switch-64x800g-osfp')!.name;
  const SW = 'device_type: switch-64x800g-osfp, port_map: [ { ports: "etp{1-64}", device_ports: "osfp/{1-64}" } ]';
  const SRV = 'device_type: server-gpu-8u, port_map: [ { ports: "p{1-2}", device_ports: "fe/{1-2}" } ]';
  const matched = (vv: VirtualTopo) => Object.fromEntries([...topoHardware(lib, vv)].map(([n, h]) => [n, h.profile?.name]));
  const v = parseVirtual(`device_set_groups:
  s:
    role: server
    count: 8
    device_type: server-gpu-8u
    port_map: [ { ports: "p{1-2}", device_ports: "fe/{1-2}" } ]
    partitions: [ { key: pod, count: 2, size: 4 } ]
    ports: { nic: p{1-2}{a-b} }
  t:
    role: tor
    count: 4
    device_type: switch-64x800g-osfp
    port_map: [ { ports: "etp{1-8}", device_ports: "osfp/{1-8}" } ]
    partitions: [ { key: pod, count: 2, size: 2 } ]
    ports: { down: etp{1-4}{a-b}, up: etp{5-8}{a-b} }
  u:
    role: spine
    count: 2
    device_type: switch-64x800g-osfp
    port_map: [ { ports: "etp{1-8}", device_ports: "osfp/{1-8}" } ]
    ports: { down: etp{1-8}a }
topo:
  - { name: s-t, from: { group: s, key: "\${pod}", ports: nic }, to: { group: t, key: "\${pod}", ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: t-u, from: { group: t, ports: up }, to: { group: u, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);

  it('parses device_type and port_map; port_map takes no mode or optic', () => {
    expect(v.problems).toEqual([]);
    const t = v.groups.find((g) => g.name === 't')!;
    expect([t.deviceType, t.portMap[0].ports[2], t.portMap[0].devicePorts[2]]).toEqual(['switch-64x800g-osfp', 'etp3', 'osfp/3']);
    const bad = parseVirtual(`device_set_groups:
  d: { role: w, count: 1, port_map: [ { ports: "q{1-2}", device_ports: "osfp/1" } ], ports: { p: q1 } }
  e: { role: w, count: 1, device_type: x, port_map: [ { ports: q1, device_ports: osfp/1, mode: 8x100G } ], ports: { p: q1 } }
  f: { role: w, count: 1, device_type: x, port_map: { ports: q1 }, ports: { p: q1 } }
`);
    expect(bad.problems.map((p) => p.message)).toEqual([
      'group d: port_map q{1-2} names 2 ports, device_ports osfp/1 1',
      'group d: port_map needs a device_type',
      "group e: port_map takes no mode or optic: they come from the device type's breakout profiles",
      'group f: port_map must be a list',
    ]);
  });
  it('matches each group a profile giving its ports, with both ends of every link at one speed', () => {
    // t alone fits "Down 4x200G, up 2x400G" best (no spare optics), but its servers run 100G: All 8x100G.
    expect(matched(v)).toEqual({ s: 'All 4x100G', t: 'All 8x100G', u: 'All 8x100G' });
    expect(hardwareProblems(lib, v)).toEqual([]);
    expect(topoHardware(lib, v).get('t')!.ports.get('etp3c')).toEqual({ cage: 'osfp/3', speedGbps: 100, opticId: O, module: true });
  });
  it('needs a module in every port a link uses, and prefers the profile with the fewest optics no link needs', () => {
    const w = parseVirtual(`device_set_groups:
  m: { role: s, count: 4, ${SRV}, ports: { nic: p{1-2} } }
  k: { role: l, count: 2, ${SW}, ports: { down: etp{1-4}{a-d} } }
  x: { role: x, count: 1, ${SW}, ports: { up: etp{5-8}{a,b} } }
topo:
  - { name: mk, from: { group: m, ports: nic }, to: { group: k, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
    // m: Default gives p1 and p2 but no optic; 4x100G splits them. k runs 200G with m. x fits 4 profiles, u2 tightest.
    expect(matched(w)).toEqual({ m: 'All 1x200G', k: 'Down 4x200G, up 2x400G', x: 'Uplinks 2x400G' });
    expect(hardwareProblems(lib, w)).toEqual([]);
  });
  it('takes a shipped profile, its reach picking the optic (the spec example)', () => {
    const plain = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const s = parseVirtual(`device_set_groups:
  dt0:
    role: dT0
    count: 2
    device_type: switch-64x800g-osfp
    port_map:
      - { ports: "etp{1-64}", device_ports: "osfp/{1-64}" }
    ports:
      down: etp{33-64}{a,b}
      up:   etp{1-32}{a,b}
`);
    const hw = topoHardware(plain, s).get('dt0')!;
    expect(hardwareProblems(plain, s)).toEqual([]);
    expect([hw.profile?.name, hw.ports.get('etp33b')?.cage, hw.ports.get('etp33b')?.speedGbps]).toEqual(['All 2x400G, 2xDR4', 'osfp/33', 400]);
    expect(plain.optics.get(hw.ports.get('etp33b')!.opticId)?.reach).toMatch(/^2xDR4/);
  });
  it('reports a group no profile fits, port map errors, and link ends no choice brings to one speed', () => {
    const bad = parseVirtual(`device_set_groups:
  z: { role: z, count: 1, ${SW}, ports: { p: etp1{a-p} } }
  n: { role: n, count: 1, device_type: switch-64x800g-osfp, port_map: [ { ports: "s{1-2}", device_ports: "service/{1-2}" } ], ports: { p: s{1-2} } }
  q: { role: q, count: 2, device_type: switch-64x800g-osfp, port_map: [ { ports: "s{1-2}", device_ports: "service/{1-2}" } ], ports: { p: s{1-2} } }
  c: { role: c, count: 1, device_type: switch-64x800g-osfp, port_map: [ { ports: "e{1-2}", device_ports: "osfp/{64-65}" }, { ports: "g1", device_ports: "osfp/64" } ], ports: { p: e1{a,b} } }
  y: { role: y, count: 1, device_type: no-such-device, ports: { p: q1 } }
  a: { role: a, count: 2, device_type: server-gpu-8u, port_map: [ { ports: "p1", device_ports: "fe/1" } ], ports: { nic: p1 } }
  b: { role: b, count: 1, device_type: switch-64x800g-osfp, port_map: [ { ports: "etp1", device_ports: "osfp/1" } ], ports: { d: etp1{a-h} } }
topo:
  - { name: nq, from: { group: n, ports: p }, to: { group: q, ports: p }, pattern: { type: mesh, per_pair: 1 } }
  - { name: ab, from: { group: a, ports: nic }, to: { group: b, ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(bad.problems).toEqual([]);
    const all = '"Default", "All 2x400G", "All 8x100G", "All 1x800G", "Uplinks 2x400G", "Down 4x200G, up 2x400G"';
    expect(hardwareProblems(lib, bad).map((p) => p.message)).toEqual([
      `group z: no breakout profile of ${swName} gives its ports ("Default", "All 1x800G", "Uplinks 2x400G": no port etp1a; "All 2x400G": no port etp1c; "All 8x100G": no port etp1i; "Down 4x200G, up 2x400G": no port etp1e)`,
      `group n: no breakout profile of ${swName} gives its ports (${all}: s1 has no optic or cable)`,
      `group q: no breakout profile of ${swName} gives its ports (${all}: s1 has no optic or cable)`,
      `group c: ${swName} has no port osfp/65`,
      'group c: port_map maps osfp/64 twice',
      'group y: device type "no-such-device" is not in the Devices module',
      'ab: a nic runs 200G, b d 100G',
    ]);
  });

  const bom = estimateTopoBom(lib, v, { items: { 'switch-64x800g-osfp': 'sw-x' } });
  it('estimates the BOM from the device types: one optic per used cage, as the matched profile fits it', () => {
    const pools = Object.fromEntries(bom.groups.flatMap((g) => g.pools.map((p) => [`${g.group.name}.${p.pool}`,
      [p.ports, p.speedGbps, p.cages, p.optics.map((o) => `${o.opticId} ${o.perDevice} ${o.total}`), p.exact]])));
    expect(pools).toEqual({
      's.nic': [2, 100, 1, ['qsfp112-400g-dr4 1 8'], true],
      't.down': [4, 100, 2, [`${O} 2 8`], true],
      't.up': [2, 100, 1, [`${O} 1 4`], true],
      'u.down': [4, 100, 4, [`${O} 4 8`], true],
    });
    expect(bom.groups.map((g) => g.profileName)).toEqual(['All 4x100G', 'All 8x100G', 'All 8x100G']);
  });
  it('merges lines by item type, with the derivation and the picked item', () => {
    expect(bom.lines.map((l) => [l.key, l.qty, l.notes[0]])).toEqual([
      ['device:server-gpu-8u', 8, 's 8'],
      ['device:switch-64x800g-osfp', 6, 't 4 + u 2'],
      ['optic:qsfp112-400g-dr4', 8, 's nic 8 × 1'],
      [`optic:${O}`, 20, 't down 4 × 2 + t up 4 × 1 + u down 2 × 4'],
    ]);
    const swLine = bom.lines[1];
    expect([swLine.vendorModel, swLine.unitW, swLine.pickKey, swLine.itemId]).toEqual(['V SW', 100, 'switch-64x800g-osfp', 'sw-x']);
    expect(bom.lines[0].itemId).toMatch(/--generic$/);
    expect(bom.links).toBe(24);
  });
  it('lists a group without a device type by its role; uneven sets give an upper bound', () => {
    const u = parseVirtual(`device_set_groups:
  s: { role: x, count: 72, partitions: [ { key: p, sizes: { "1": 54, "2": 18 } } ], ports: { n: e{1-2} } }
  t:
    role: y
    count: 4
    device_type: switch-64x800g-osfp
    port_map: [ { ports: "e{1-64}", device_ports: "osfp/{1-64}" } ]
    partitions: [ { key: p, count: 2, size: 2 } ]
    ports: { d: e{1-60} }
topo:
  - { name: l, from: { group: s, key: "\${p}", ports: n }, to: { group: t, key: "\${p}", ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(hardwareProblems(lib, u)).toEqual([]);
    const b = estimateTopoBom(lib, u, {});
    expect(b.groups[1].profileName).toBe('All 1x800G');
    expect(b.lines.map((l) => [l.item, l.qty, l.notes[0]])).toEqual([
      ['x (no device type)', 72, 's 72'],
      [swName, 4, 't 4'],
      [lib.optics.get(O)!.name, 216, 't d 4 × ≤54'],
    ]);
    // 54 + 54 + 18 + 18 links: the dT0 of the small set use 18 ports, not 54.
    expect(b.groups.map((g) => g.pools[0].exact)).toEqual([true, false]);
  });
  it('counts a cage two pools share once, under the first pool', () => {
    const u = parseVirtual(`device_set_groups:
  x:
    role: x
    count: 1
    device_type: switch-64x800g-osfp
    port_map: [ { ports: "etp1", device_ports: "osfp/1" } ]
    ports: { a: etp1{a-b}, b: etp1{c-d} }
  y: { role: y, count: 2, ports: { p: q{1-4} } }
topo:
  - { name: l1, from: { group: x, ports: a }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
  - { name: l2, from: { group: x, ports: b }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(estimateTopoBom(lib, u, {}).groups[0].pools.map((p) => [p.pool, p.ports, p.cages])).toEqual([['a', 2, 1], ['b', 2, 0]]);
  });
  it('shows the derivation column and Qty with thousands separators', () => {
    expect(topoBomColumns([]).map((c) => c.header)).toEqual(['Item', 'Category', 'Vendor / Model (PN)', 'Qty', 'Derivation', 'Power/pcs', 'Total W']);
    const optic = lib.optics.get(O)!.name;
    expect(topoBomColumns([]).map((c) => c.cell(bom.lines[3]))).toEqual([optic, 'Optic', `Generic ${optic}`, '20', 't down 4 × 2 + t up 4 × 1 + u down 2 × 4', '', '']);
    // Power of one piece (the picked item's typical W), then Qty x that; both shown as power in the table.
    expect(topoBomColumns([]).slice(-2).map((c) => [c.cell(bom.lines[1]), c.power])).toEqual([[100, true], [600, true]]);
    expect(topoBomColumns([]).find((c) => c.header === 'Qty')!.cell({ ...bom.lines[0], qty: 16384 })).toBe('16,384');
  });
});

describe('topologies in the project file', () => {
  it('round-trips and defaults to an empty list', () => {
    expect(emptyProject().topologies).toEqual([]);
    const p = { ...emptyProject(), topologies: [{ id: 't', name: 'T', source: 'topology: x', view: { offsets: { a: { dx: 10, dy: -5 } }, collapsed: ['b'] },
      bom: { items: { dev: 'item' } } }] };
    expect(normalizeProject(JSON.parse(serializeProject(p))).topologies).toEqual(p.topologies);
    expect(normalizeProject({}).topologies).toEqual([]);
  });
  it('drops device types and optics older files picked in the BOM pane (they are in the YAML now)', () => {
    const t = (bom: object) => normalizeProject({ topologies: [{ id: 't', name: 'T', source: '', bom }] }).topologies[0];
    expect(t({ devices: { a: 'd' }, optics: { 'a.p': 'o' }, items: { d: 'i' } }).bom).toEqual({ items: { d: 'i' } });
    expect('bom' in t({ devices: { a: 'd' } })).toBe(false);
  });
});
