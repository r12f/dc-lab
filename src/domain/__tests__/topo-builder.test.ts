import { describe, expect, it } from 'vitest';
import { parseYaml, YamlError } from '../topo/yaml';
import { expandPorts, parseVirtual, poolPorts, type VirtualTopo } from '../topo/virtual';
import { DEFAULT_OPTIONS, groupDevices, layoutDiagram, M, type GroupBox } from '../topo/diagram';
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
  it('names the device type in the box header, which grows a line', () => {
    const d = layoutDiagram(v, DEFAULT_OPTIONS, {}, { t1: '64x800G OSFP Switch (2PSU)' });
    const [plain, named] = [box('t1'), box('t1', d)];
    expect([plain.device, plain.head, named.device, named.head]).toEqual([undefined, M.head, '64x800G OSFP Switch (2PSU)', M.head + M.headLine]);
    expect([named.body.y - plain.body.y, named.h - plain.h]).toEqual([M.headLine, M.headLine]);
    expect(box('t1', layoutDiagram(v, DEFAULT_OPTIONS, { collapsed: ['t1'] }, { t1: 'X' })).h).toBe(M.head + M.headLine);
  });
  it('lets the split be chosen per group, and the port grids hidden', () => {
    const e = layoutDiagram(v, { partition: { t0: 'su>plane', server: '' }, ports: false });
    expect(sets(box('t0', e))).toEqual(['su 1', 'su 2', 'su 4']);
    expect(box('t0', e).grids).toEqual([]);
    expect(box('server', e).nesting).toEqual([]);
    expect(labels(box('server', e))).toEqual(['1', '2', '64']);
  });
});

describe('device type, pool optics and cables: the breakout profile is matched to the ports', () => {
  // Test-local item (made-up vendor, model and power) and breakout profiles.
  const sw: ItemVariant = { id: 'sw-x', name: 'SW', target: 'device', itemId: 'switch-64x800g-osfp', vendor: 'V', model: 'SW', properties: {}, specs: { typicalW: 100 } };
  const profile = (id: string, name: string, groupDefaults: Record<string, PortSetting>, overrides: Record<string, PortSetting> = {}): BreakoutProfile =>
    ({ id, name, groupDefaults, overrides });
  const O = 'osfp-800g-2xdr4-ihs';
  const Q = 'qsfp112-400g-dr4';
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
      profile('s4', 'All 4x100G', { fe: { mode: '4x100G', opticId: Q } }),
      profile('s1', 'All 1x200G', { fe: { mode: '1x200G', opticId: Q } }),
    ] },
  });
  const swName = lib.devices.get('switch-64x800g-osfp')!.name;
  const matched = (vv: VirtualTopo) => Object.fromEntries([...topoHardware(lib, vv)].map(([n, h]) => [n, h.profile?.name]));
  const v = parseVirtual(`device_set_groups:
  s:
    role: server
    count: 8
    device_type: server-gpu-8u
    partitions: [ { key: pod, count: 2, size: 4 } ]
    ports: { nic: { ports: fe{1-2}{a-b}, optic: ${Q}, cable: mpo12-smf } }
  t:
    role: tor
    count: 4
    device_type: switch-64x800g-osfp
    partitions: [ { key: pod, count: 2, size: 2 } ]
    ports:
      down: { ports: etp{1-4}{a-b}, optic: ${O}, cable: mpo12-smf }
      up:
        ports: etp{5-8}{a-b}
        optic: ${O}
  u:
    role: spine
    count: 2
    device_type: switch-64x800g-osfp
    ports: { down: { ports: etp{1-8}a, optic: ${O}, cable: mpo12-4xlc-smf-breakout } }
topo:
  - { name: s-t, from: { group: s, key: "\${pod}", ports: nic }, to: { group: t, key: "\${pod}", ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: t-u, from: { group: t, ports: up }, to: { group: u, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);

  it('parses pools with the optic and cable their ports take; port_map is not used', () => {
    expect(v.problems).toEqual([]);
    const [s, t] = v.groups;
    expect([s.poolNames.nic, s.poolOptics, s.poolCables, t.poolOptics, t.poolCables])
      .toEqual([['fe1a', 'fe1b', 'fe2a', 'fe2b'], { nic: Q }, { nic: 'mpo12-smf' }, { down: O, up: O }, { down: 'mpo12-smf' }]);
    const bad = parseVirtual(`device_set_groups:
  a: { role: w, count: 1, device_type: x, port_map: [ { ports: q1, device_ports: osfp/1 } ], ports: { p: q1 } }
  b: { role: w, count: 1, ports: { r: { optic: o1 }, s: { ports: q3, mode: 8x100G } } }
`);
    expect(bad.problems.map((p) => p.message)).toEqual([
      "group a: port_map is not used: a pool port's number is its device port (etp12b = data port 12, lane b; fe1 = port 1 of port group fe)",
      'group b: pool r has no ports',
      'group b: pool s takes ports, optic, cable, not mode',
    ]);
  });
  it("puts a pool port on its device port by number: its port group's, else the n-th data port", () => {
    const hw = topoHardware(lib, v);
    expect(hw.get('s')!.ports.get('fe2b')).toMatchObject({ cage: 'fe/2', mode: '4x100G', fanout: 4, speedGbps: 100 });
    expect(hw.get('t')!.ports.get('etp3b')).toMatchObject({ cage: 'osfp/3', mode: '8x100G', fanout: 8, speedGbps: 100 });
    // The GPU server's 8 OSFP NICs come first among its data ports: p9 is fe/1.
    const w = parseVirtual('device_set_groups:\n  g: { role: g, count: 1, device_type: server-gpu-8u, ports: { a: p9, b: nic8 } }\n');
    expect([...topoHardware(lib, w).get('g')!.ports].map(([n, p]) => [n, p.cage])).toEqual([['p9', 'fe/1'], ['nic8', 'nic/8']]);
  });
  it('matches each group a profile giving its ports, with both ends of every link at one speed', () => {
    // t alone fits "Down 4x200G, up 2x400G" best (no spare modules), but its servers run 100G: All 8x100G.
    expect(matched(v)).toEqual({ s: 'All 4x100G', t: 'All 8x100G', u: 'All 8x100G' });
    expect(hardwareProblems(lib, v)).toEqual([]);
    // Alone, the profile fitting the fewest modules no port uses wins.
    const w = parseVirtual('device_set_groups:\n  x: { role: x, count: 1, device_type: switch-64x800g-osfp, ports: { up: etp{5-8}{a,b} } }\n');
    expect(matched(w)).toEqual({ x: 'Uplinks 2x400G' });
  });
  it("needs a pool's optic to carry its cages' mode, and no faster than the cages", () => {
    const w = parseVirtual(`device_set_groups:
  a: { role: a, count: 1, device_type: server-gpu-8u, ports: { p: { ports: fe1, optic: qsfp56-200g-dr4 } } }
  b: { role: b, count: 1, device_type: server-gpu-8u, ports: { p: { ports: fe1, optic: qsfp28-100g-psm4 } } }
  k: { role: k, count: 1, device_type: switch-64x800g-osfp, ports: { p: { ports: etp1{a,b}, optic: osfp-1600g-2xdr4-ihs } } }
`);
    // A 200G module runs fe1 at 1x200G, not the native 400G.
    expect(matched(w).a).toBe('All 1x200G');
    const gpu = lib.devices.get('server-gpu-8u')!.name;
    expect(hardwareProblems(lib, w).map((p) => p.message)).toEqual([
      `group b: no breakout profile of ${gpu} gives its ports ("Default": p has 100G optics, fe/1 runs 1x400G; "All 4x100G": no port fe1; "All 1x200G": p has 100G optics, fe/1 runs 1x200G)`,
      `group k: pool p: ${lib.optics.get('osfp-1600g-2xdr4-ihs')!.name} is 1.6T, the OSFP cages 800G`,
    ]);
  });
  it('checks the optic and cable each pool sets, and a direct-attach cable against the other end', () => {
    const w = parseVirtual(`device_set_groups:
  a:
    role: a
    count: 1
    device_type: switch-64x800g-osfp
    ports:
      p1: { ports: etp1, optic: nope }
      p2: { ports: etp2, optic: ${Q} }
      p3: { ports: etp3, optic: osfp-800g-2xdr4 }
      p4: { ports: etp4, cable: nope }
      p5: { ports: etp5, optic: ${O}, cable: dac-800g }
      p6: { ports: etp6, cable: mpo12-smf }
      p7: { ports: etp7, optic: ${O}, cable: lc-smf }
      p8: { ports: etp8, cable: dac-400g-qsfpdd-2x200g }
`);
    const name = (id: string) => lib.optics.get(id)?.name ?? lib.cableMedia.get(id)!.name;
    expect(hardwareProblems(lib, w).map((p) => p.message).filter((m) => m.startsWith('group a: pool'))).toEqual([
      'group a: pool p1 optic "nope" is not in Optics & Cables',
      `group a: pool p2: ${name(Q)} does not fit the OSFP cages`,
      `group a: pool p3: ${name('osfp-800g-2xdr4')} is RHS, the OSFP cages IHS`,
      'group a: pool p4 cable "nope" is not in Optics & Cables',
      `group a: pool p5: ${name('dac-800g')} plugs into the cage itself, so the pool takes no optic`,
      `group a: pool p6: ${name('mpo12-smf')} needs an optic in the cage`,
      `group a: pool p7: ${name('lc-smf')} does not fit ${name(O)}`,
      `group a: pool p8: ${name('dac-400g-qsfpdd-2x200g')} does not plug into the OSFP cages`,
    ]);
    const x = parseVirtual(`device_set_groups:
  a: { role: a, count: 1, device_type: switch-64x800g-osfp, ports: { p: { ports: etp{1-2}, cable: dac-800g } } }
  b: { role: b, count: 1, device_type: switch-64x800g-osfp, ports: { p: { ports: etp1, optic: ${O} } } }
  c: { role: c, count: 1, device_type: switch-64x800g-osfp, ports: { p: { ports: etp1, cable: aoc-800g } } }
topo:
  - { name: ab, from: { group: a, ports: p }, to: { group: b, ports: p }, pattern: { type: mesh, per_pair: 1 } }
  - { name: ac, from: { group: a, ports: p }, to: { group: c, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(hardwareProblems(lib, x).map((p) => p.message)).toEqual([
      `ab: ${name('dac-800g')} joins both cages, but b p has an optic`,
      `ac: ${name('dac-800g')} joins both cages, but c p takes ${name('aoc-800g')}`,
    ]);
  });
  it('takes a shipped profile (the spec example)', () => {
    const plain = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const s = parseVirtual(`device_set_groups:
  dt0:
    role: dT0
    count: 2
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "etp{33-64}{a,b}", optic: ${O} }
      up:   { ports: "etp{1-32}{a,b}", optic: ${O} }
`);
    const hw = topoHardware(plain, s).get('dt0')!;
    expect(hardwareProblems(plain, s)).toEqual([]);
    expect([hw.profile?.name, hw.ports.get('etp33b')?.cage, hw.ports.get('etp33b')?.speedGbps]).toEqual(['All 2x400G, 2xDR4', 'osfp/33', 400]);
  });
  it('reports a group no profile fits, ports the device lacks, and link ends no choice brings to one speed', () => {
    const bad = parseVirtual(`device_set_groups:
  z: { role: z, count: 1, device_type: switch-64x800g-osfp, ports: { p: etp1{a-p} } }
  c: { role: c, count: 1, device_type: switch-64x800g-osfp, ports: { p: etp{64-66}, q: mgmt } }
  y: { role: y, count: 1, device_type: no-such-device, ports: { p: q1 } }
  a: { role: a, count: 2, device_type: server-gpu-8u, ports: { nic: { ports: fe1, optic: ${Q} } } }
  b: { role: b, count: 1, device_type: switch-64x800g-osfp, ports: { d: etp1{a-h} } }
topo:
  - { name: ab, from: { group: a, ports: nic }, to: { group: b, ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(bad.problems).toEqual([]);
    expect(hardwareProblems(lib, bad).map((p) => p.message)).toEqual([
      `group z: no breakout profile of ${swName} gives its ports ("Default", "All 1x800G", "Uplinks 2x400G": no port etp1a; "All 2x400G": no port etp1c; "All 8x100G": no port etp1i; "Down 4x200G, up 2x400G": no port etp1e)`,
      `group c: pool p names etp65 (and 1 more), ${swName} has no such port (64 data ports)`,
      'group c: pool q port mgmt has no port number',
      'group y: device type "no-such-device" is not in the Devices module',
      // a: the profile setting fe (1x200G; the 400G module carries it) wins over native 400G.
      'ab: a nic runs 200G, b d 100G',
    ]);
  });

  const bom = estimateTopoBom(lib, v, { items: { 'switch-64x800g-osfp': 'sw-x' } });
  it("estimates optics from each pool's optic: one per cage its used ports sit in", () => {
    const pools = Object.fromEntries(bom.groups.flatMap((g) => g.pools.map((p) => [`${g.group.name}.${p.pool}`,
      [p.ports, p.speedGbps, p.cages, p.optics.map((o) => `${o.opticId} ${o.perDevice} ${o.total}`), p.exact]])));
    expect(pools).toEqual({
      's.nic': [2, 100, 1, [`${Q} 1 8`], true],
      't.down': [4, 100, 2, [`${O} 2 8`], true],
      't.up': [2, 100, 1, [`${O} 1 4`], true],
      'u.down': [4, 100, 4, [`${O} 4 8`], true],
    });
    expect(bom.groups.map((g) => g.profileName)).toEqual(['All 4x100G', 'All 8x100G', 'All 8x100G']);
  });
  it('counts the cables of each link spec over the links one cable carries', () => {
    // s-t: both ends take the MPO patch, one cable joins them; a QSFP112 DR4 at 4x100G holds 4 lanes per MPO.
    // t-u: only u sets a cable, a 1 MPO to 4 LC breakout on a 2xDR4 module at 8x100G (4 lanes per MPO).
    expect(bom.cables.map((c) => [c.link.name, c.cableId, c.end, c.perCable, c.qty])).toEqual([
      ['s-t', 'mpo12-smf', undefined, 4, 4],
      ['t-u', 'mpo12-4xlc-smf-breakout', 'u', 4, 2],
    ]);
  });
  it('merges lines by item type, with the derivation and the picked item', () => {
    expect(bom.lines.map((l) => [l.key, l.qty, l.notes[0]])).toEqual([
      ['device:server-gpu-8u', 8, 's 8'],
      ['device:switch-64x800g-osfp', 6, 't 4 + u 2'],
      [`optic:${Q}`, 8, 's nic 8 × 1'],
      [`optic:${O}`, 20, 't down 4 × 2 + t up 4 × 1 + u down 2 × 4'],
      ['cable:mpo12-smf', 4, 's-t 16 ÷ 4'],
      ['cable:mpo12-4xlc-smf-breakout', 2, 't-u (u end) 8 ÷ 4'],
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
    partitions: [ { key: p, count: 2, size: 2 } ]
    ports: { d: { ports: e{1-60}, optic: ${O} } }
topo:
  - { name: l, from: { group: s, key: "\${p}", ports: n }, to: { group: t, key: "\${p}", ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(hardwareProblems(lib, u)).toEqual([]);
    const b = estimateTopoBom(lib, u, {});
    // Both run the cages at 1x800G; the profile that sets them wins over native defaults.
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
    ports: { a: { ports: etp1{a-b}, optic: ${O} }, b: { ports: etp1{c-d}, optic: ${O} } }
  y: { role: y, count: 2, ports: { p: q{1-4} } }
topo:
  - { name: l1, from: { group: x, ports: a }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
  - { name: l2, from: { group: x, ports: b }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(estimateTopoBom(lib, u, {}).groups[0].pools.map((p) => [p.pool, p.ports, p.cages, p.optics.length])).toEqual([['a', 2, 1, 1], ['b', 2, 0, 0]]);
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
