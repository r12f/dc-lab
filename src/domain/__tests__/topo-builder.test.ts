import { describe, expect, it } from 'vitest';
import { parseYaml, YamlError } from '../topo/yaml';
import { expandPorts, parseVirtual, poolPorts } from '../topo/virtual';
import { DEFAULT_OPTIONS, groupDevices, layoutDiagram, type GroupBox } from '../topo/diagram';
import { pick, sliceTopo, withGaps } from '../topo/slice';
import { portLayout, portUse } from '../topo/ports';
import { ruleText } from '../topo/rule';
import { estimateTopoBom, topoBomColumns } from '../topo/bom';
import { groupHardware, hardwareProblems } from '../topo/hardware';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import { normalizeProject, serializeProject } from '../project/serializer';
import { emptyProject } from '../project/types';
import { Library } from '../library/library';
import type { ItemVariant } from '../items/types';
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

describe('device type and port map', () => {
  // Test-local item (made-up vendor, model and power).
  const sw: ItemVariant = { id: 'sw-x', name: 'SW', target: 'device', itemId: 'switch-64x800g-osfp', vendor: 'V', model: 'SW', properties: {}, specs: { typicalW: 100 } };
  const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [sw] });
  const v = parseVirtual(`device_set_groups:
  s:
    role: server
    count: 8
    device_type: server-gpu-8u
    port_map:
      - { ports: "p{1-2}", device_ports: "fe/{1-2}", mode: 4x100G, optic: qsfp112-400g-dr4 }
    partitions: [ { key: pod, count: 2, size: 4 } ]
    ports: { nic: p{1-2}{a-b} }
  t:
    role: tor
    count: 4
    device_type: switch-64x800g-osfp
    port_map:
      - { ports: "etp{1-8}", device_ports: "osfp/{1-8}", mode: 8x100G, optic: osfp-800g-2xdr4-ihs }
    partitions: [ { key: pod, count: 2, size: 2 } ]
    ports: { down: etp{1-4}{a-b}, up: etp{5-8}{a-b} }
  u:
    role: spine
    count: 2
    device_type: switch-64x800g-osfp
    port_map:
      - { ports: "etp{1-8}", device_ports: "osfp/{1-8}", mode: 8x100G, optic: osfp-800g-2xdr4-ihs }
    ports: { down: etp{1-8}a }
topo:
  - { name: s-t, from: { group: s, key: "\${pod}", ports: nic }, to: { group: t, key: "\${pod}", ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: t-u, from: { group: t, ports: up }, to: { group: u, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
  const group = (n: string, vv = v) => vv.groups.find((g) => g.name === n)!;

  it('parses device_type and port_map', () => {
    expect(v.problems).toEqual([]);
    const t = group('t');
    expect([t.deviceType, t.portMap[0].ports[2], t.portMap[0].devicePorts[2], t.portMap[0].mode, t.portMap[0].optic])
      .toEqual(['switch-64x800g-osfp', 'etp3', 'osfp/3', '8x100G', 'osfp-800g-2xdr4-ihs']);
    const bad = parseVirtual(`device_set_groups:
  d: { role: w, count: 1, port_map: [ { ports: "q{1-2}", device_ports: "osfp/1" } ], ports: { p: q1 } }
  e: { role: w, count: 1, device_type: x, port_map: { ports: q1 }, ports: { p: q1 } }
`);
    expect(bad.problems.map((p) => p.message)).toEqual([
      'group d: port_map q{1-2} names 2 ports, device_ports osfp/1 1',
      'group d: port_map needs a device_type',
      'group e: port_map must be a list',
    ]);
  });
  it('resolves topology ports on the device type: a breakout mode gives sub-ports a, b, …; native keeps the name', () => {
    const hw = groupHardware(lib, group('t'));
    expect(hw.ports.size).toBe(64);
    expect(hw.ports.get('etp3c')).toEqual({ cage: 'osfp/3', speedGbps: 100, opticId: 'osfp-800g-2xdr4-ihs' });
    const native = parseVirtual(`device_set_groups:
  n: { role: w, count: 1, device_type: switch-64x800g-osfp, port_map: [ { ports: "x{1-2}", device_ports: "osfp/{9-10}" } ], ports: { p: x{1-2} } }
`);
    expect(groupHardware(lib, group('n', native)).ports.get('x2')).toEqual({ cage: 'osfp/10', speedGbps: 800 });
    expect(hardwareProblems(lib, v)).toEqual([]);
  });
  it('reports what the device type does not take, and link ends at different speeds', () => {
    const bad = parseVirtual(`device_set_groups:
  a:
    role: x
    count: 2
    device_type: switch-64x800g-osfp
    port_map:
      - { ports: "e{1-2}", device_ports: "osfp/{1-2}", mode: 2x400G, optic: qsfp112-400g-dr4 }
      - { ports: "f{1-2}", device_ports: "osfp/{64-65}", mode: 16x50G }
    ports: { up: e{1-2}{a-b}, more: g1a }
  b:
    role: y
    count: 2
    device_type: switch-64x800g-osfp
    port_map:
      - { ports: "e{1-2}", device_ports: "osfp/{1-2}", mode: 8x100G }
    ports: { down: e1{a-d} }
  c: { role: z, count: 1, device_type: no-such-device, ports: { p: q1 } }
topo:
  - { name: ab, from: { group: a, ports: up }, to: { group: b, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(bad.problems).toEqual([]);
    const msgs = hardwareProblems(lib, bad).map((p) => p.message);
    expect(msgs).toHaveLength(6);
    expect(msgs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^group a: .+ does not fit .+ ports at 2x400G$/),
      expect.stringMatching(/^group a: .+ has no port osfp\/65$/),
      expect.stringMatching(/^group a: .+ ports have no mode 16x50G \(1x800G, 2x400G/),
      'group a: pool more port g1a is not in the port map',
      'group c: device type "no-such-device" is not in the Devices module',
      'ab: a up runs 400G, b down 100G',
    ]));
  });

  const bom = estimateTopoBom(lib, v, { items: { 'switch-64x800g-osfp': 'sw-x' } });
  it('estimates the BOM from the device types: one optic per used cage of the port map', () => {
    const pools = Object.fromEntries(bom.groups.flatMap((g) => g.pools.map((p) => [`${g.group.name}.${p.pool}`,
      [p.ports, p.speedGbps, p.cages, p.optics.map((o) => `${o.opticId} ${o.perDevice} ${o.total}`), p.exact]])));
    expect(pools).toEqual({
      's.nic': [2, 100, 1, ['qsfp112-400g-dr4 1 8'], true],
      't.down': [4, 100, 2, ['osfp-800g-2xdr4-ihs 2 8'], true],
      't.up': [2, 100, 1, ['osfp-800g-2xdr4-ihs 1 4'], true],
      'u.down': [4, 100, 4, ['osfp-800g-2xdr4-ihs 4 8'], true],
    });
  });
  it('merges lines by item type, with the derivation and the picked item', () => {
    expect(bom.lines.map((l) => [l.key, l.qty, l.notes[0]])).toEqual([
      ['device:server-gpu-8u', 8, 's 8'],
      ['device:switch-64x800g-osfp', 6, 't 4 + u 2'],
      ['optic:qsfp112-400g-dr4', 8, 's nic 8 × 1'],
      ['optic:osfp-800g-2xdr4-ihs', 20, 't down 4 × 2 + t up 4 × 1 + u down 2 × 4'],
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
    port_map:
      - { ports: "e{1-64}", device_ports: "osfp/{1-64}", optic: osfp-800g-2xdr4-ihs }
    partitions: [ { key: p, count: 2, size: 2 } ]
    ports: { d: e{1-60} }
topo:
  - { name: l, from: { group: s, key: "\${p}", ports: n }, to: { group: t, key: "\${p}", ports: d }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(hardwareProblems(lib, u)).toEqual([]);
    const b = estimateTopoBom(lib, u, {});
    expect(b.lines.map((l) => [l.item, l.qty, l.notes[0]])).toEqual([
      ['x (no device type)', 72, 's 72'],
      [lib.devices.get('switch-64x800g-osfp')!.name, 4, 't 4'],
      [lib.optics.get('osfp-800g-2xdr4-ihs')!.name, 216, 't d 4 × ≤54'],
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
    port_map: [ { ports: "etp1", device_ports: "osfp/1", mode: 4x200G } ]
    ports: { a: etp1{a-b}, b: etp1{c-d} }
  y: { role: y, count: 2, ports: { p: q{1-4} } }
topo:
  - { name: l1, from: { group: x, ports: a }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
  - { name: l2, from: { group: x, ports: b }, to: { group: y, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(estimateTopoBom(lib, u, {}).groups[0].pools.map((p) => [p.pool, p.ports, p.cages])).toEqual([['a', 2, 1], ['b', 2, 0]]);
  });
  it('shows the derivation column and Qty with thousands separators', () => {
    expect(topoBomColumns([]).map((c) => c.header)).toEqual(['Item', 'Category', 'Vendor / Model (PN)', 'Qty', 'Derivation', 'Total W']);
    const optic = lib.optics.get('osfp-800g-2xdr4-ihs')!.name;
    expect(topoBomColumns([]).map((c) => c.cell(bom.lines[3]))).toEqual([optic, 'Optic', `Generic ${optic}`, '20', 't down 4 × 2 + t up 4 × 1 + u down 2 × 4', '']);
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
