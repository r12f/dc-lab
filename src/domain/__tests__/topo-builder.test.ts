import { describe, expect, it } from 'vitest';
import { parseYaml, YamlError } from '../topo/yaml';
import { expandPorts, parseVirtual, poolPorts } from '../topo/virtual';
import { layoutDiagram } from '../topo/diagram';
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
    expect(d.links).toHaveLength(3);
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
