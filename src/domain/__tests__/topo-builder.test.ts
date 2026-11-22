import { describe, expect, it } from 'vitest';
import { parseYaml, YamlError } from '../topo/yaml';
import { expandPorts, parseVirtual, poolPorts } from '../topo/virtual';
import { groupDevices, layoutDiagram } from '../topo/diagram';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import { normalizeProject, serializeProject } from '../project/serializer';
import { emptyProject } from '../project/types';

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
  it('flags a pool too small for the pattern', () => {
    const p = parseVirtual(`device_set_groups:
  a: { role: x, count: 4, ports: { p: e{1-2} } }
  b: { role: y, count: 3, ports: { p: e{1-8} } }
topo:
  - { name: l, from: { group: a, ports: p }, to: { group: b, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`).problems.map((x) => x.message);
    expect(p).toEqual(['l: each a device needs 3 ports, pool p has 2']);
  });
  it('lays tiers out bottom-up from the link direction', () => {
    const d = layoutDiagram(v);
    const y = Object.fromEntries(d.boxes.map((b) => [b.group.name, b.y]));
    expect(y.server).toBeGreaterThan(y.t0);
    expect(y.t0).toBeGreaterThan(y.t1);
    expect(y.t1).toBeGreaterThan(y.t2);
    expect(d.labels).toHaveLength(3);
  });
  const labels = (b: ReturnType<typeof layoutDiagram>['boxes'][number]) => groupDevices(b).map((x) => x.label);
  const sets = (b: ReturnType<typeof layoutDiagram>['boxes'][number]) => b.body.sets.map((s) => s.label);
  it('splits a group by the mapped key, then the key it is reached by; three values at most, ellipsis between', () => {
    const d = layoutDiagram(v);
    const box = (n: string) => d.boxes.find((b) => b.group.name === n)!;
    // t0 planes 1, 5 map onto t1 plane 1: only those planes; inside, one device per su, labelled by su.
    expect(box('t0').nesting).toEqual(['plane', 'su']);
    expect(sets(box('t0'))).toEqual(['plane 1', 'plane 5']);
    expect(labels(box('t0'))).toEqual(['1', '2', '4', '1', '2', '4']);
    expect(box('t0').body.sets[0].sets[0].ellipses).toHaveLength(1);
    expect(sets(box('t1'))).toEqual(['plane 1']);
    expect(labels(box('t1'))).toEqual(['1', '2', '4']);
    // server su 1, 2, ..., 4; 16 devices each: 1, 2, ..., 16.
    expect(sets(box('server'))).toEqual(['su 1', 'su 2', 'su 4']);
    expect(labels(box('server')).slice(0, 3)).toEqual(['1', '2', '16']);
  });
  it('draws device-to-device lines following the key, the map and the pattern', () => {
    const d = layoutDiagram(v);
    const n = (name: string) => d.links.filter((p) => p.name === name).length;
    // t0-t1 mesh: 6 drawn t0 devices (planes 1, 5) x 3 drawn t1 plane-1 devices.
    expect(n('t0-t1')).toBe(18);
    // server-t0 by su: server su 1 devices (3) to t0 devices of su 1 (planes 1, 5) = 6, same for su 2 and su 4.
    expect(n('server-t0')).toBe(18);
    // t1-t2 round-robin: each drawn t1 device to one t2 device, only t2 1-3 of a plane (t2 #4 gets none).
    const t12 = d.links.filter((p) => p.name === 't1-t2');
    expect(t12).toHaveLength(3);
    const t2 = groupDevices(d.boxes.find((b) => b.group.name === 't2')!);
    const hit = new Set(t12.map((p) => t2.find((x) => Math.abs(x.x + x.w / 2 - p.points[1][0]) < 1)!.label));
    expect([...hit].every((x) => Number(x) <= 3)).toBe(true);
    const l01 = v.links.find((l) => l.name === 't0-t1')!;
    expect([l01.fanIn, l01.fromSize, l01.toSize, l01.fromPorts, l01.toPorts]).toEqual([2, 4, 4, 4, 8]);
  });
  it('lets the split be chosen per group', () => {
    const d = layoutDiagram(v, { partition: { t0: 'su>plane', server: '' }, ports: false });
    const t0 = d.boxes.find((b) => b.group.name === 't0')!;
    expect(sets(t0)).toEqual(['su 1', 'su 2', 'su 4']);
    expect(t0.portsLine).toBeUndefined();
    const server = d.boxes.find((b) => b.group.name === 'server')!;
    expect(server.nesting).toEqual([]);
    expect(labels(server)).toEqual(['1', '2', '64']);
  });
});

describe('topologies in the project file', () => {
  it('round-trips and defaults to an empty list', () => {
    expect(emptyProject().topologies).toEqual([]);
    const p = { ...emptyProject(), topologies: [{ id: 't', name: 'T', source: 'topology: x' }] };
    expect(normalizeProject(JSON.parse(serializeProject(p))).topologies).toEqual(p.topologies);
    expect(normalizeProject({}).topologies).toEqual([]);
  });
});
