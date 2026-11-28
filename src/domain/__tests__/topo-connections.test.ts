import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import {
  CONNECTION_CSV_HEADERS,
  connectionsToCsv,
  expandTopoConnections,
  filterConnections,
} from '../topo/connections';
import { topoHardware } from '../topo/hardware';
import { portUse } from '../topo/ports';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import { parseVirtual, type VLink } from '../topo/virtual';
import { SHIPPED_CATALOG } from './catalog-fixture';

describe('expandTopoConnections — SAMPLE_TOPOLOGY', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());
  const virtual = parseVirtual(SAMPLE_TOPOLOGY);
  const rows = expandTopoConnections(lib, virtual);

  it('expands SAMPLE_TOPOLOGY with exact VLink.links counts, sequential indices, and zero port overruns', () => {
    expect(virtual.problems).toEqual([]);
    const expectedByLink = Object.fromEntries(virtual.links.map((l) => [l.name, l.links]));
    expect(expectedByLink).toEqual({ 'server-t0': 512, 't0-t1': 128, 't1-t2': 32 });

    const actualByLink: Record<string, number> = {};
    for (const r of rows) {
      actualByLink[r.linkName] = (actualByLink[r.linkName] ?? 0) + 1;
    }
    expect(actualByLink).toEqual(expectedByLink);
    expect(rows).toHaveLength(672);
    expect(rows.map((r) => r.index)).toEqual(Array.from({ length: 672 }, (_, i) => i + 1));

    // Every allocated pool port is non-empty and used at most once per (device, pool).
    const seenDevicePorts = new Set<string>();
    for (const r of rows) {
      expect(r.fromPoolPort).not.toBe('');
      expect(r.toPoolPort).not.toBe('');
      const fromKey = `${r.fromDeviceId}\u0000${r.fromPool}\u0000${r.fromPoolPort}`;
      const toKey = `${r.toDeviceId}\u0000${r.toPool}\u0000${r.toPoolPort}`;
      expect(seenDevicePorts.has(fromKey)).toBe(false);
      expect(seenDevicePorts.has(toKey)).toBe(false);
      seenDevicePorts.add(fromKey);
      seenDevicePorts.add(toKey);

      // No device type in SAMPLE_TOPOLOGY -> physical device port & mode are "", speedGbps is undefined.
      expect(r.fromDevicePort).toBe('');
      expect(r.toDevicePort).toBe('');
      expect(r.fromMode).toBe('');
      expect(r.toMode).toBe('');
      expect(r.speedGbps).toBeUndefined();
    }
  });

  it('agrees with portUse() per-device port ownership on unfiltered groups and respects t2 plane.index 1-3 filter', () => {
    for (const gName of ['server', 't0', 't1'] as const) {
      const group = virtual.groups.find((g) => g.name === gName)!;
      const expected = portUse(group, virtual);
      for (let i = 1; i <= group.count; i++) {
        const devId = `${gName}-${i}`;
        const owner = new Map<string, number>();
        const used = new Map<string, number>(Object.keys(group.poolNames).map((p) => [p, 0]));
        for (const r of rows) {
          if (r.fromDeviceId === devId) {
            owner.set(r.fromPoolPort, r.linkIndex);
            used.set(r.fromPool, (used.get(r.fromPool) ?? 0) + 1);
          }
          if (r.toDeviceId === devId) {
            owner.set(r.toPoolPort, r.linkIndex);
            used.set(r.toPool, (used.get(r.toPool) ?? 0) + 1);
          }
        }
        expect(used).toEqual(expected.used);
        expect(owner).toEqual(expected.owner);
      }
    }

    // t2 has 2 planes of 4 devices (`t2-1..t2-4` in plane 1, `t2-5..t2-8` in plane 2); `plane.index: 1-3` excludes t2-4 and t2-8.
    const t2Used = new Set(rows.filter((r) => r.linkName === 't1-t2').map((r) => r.toDeviceId));
    expect(t2Used.has('t2-4')).toBe(false);
    expect(t2Used.has('t2-8')).toBe(false);
    expect([...t2Used].every((id) => /^t2-[123567]$/.test(id))).toBe(true);
  });

  it('advances per-pool cursors across multiple link specs sharing a pool, wraps round-robin modulo, and preserves member order', () => {
    // 1. Two link specs sharing `(a, up)` advance the pool cursor sequentially and match `portUse(a, v)`.
    const sharedPool = parseVirtual(`device_set_groups:
  a: { role: leaf, count: 2, ports: { up: p{1-6} } }
  b: { role: spine, count: 2, ports: { down: q{1-2} } }
  c: { role: core, count: 3, ports: { down: r{1-2} } }
topo:
  - { name: a-b, from: { group: a, ports: up }, to: { group: b, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: a-c, from: { group: a, ports: up }, to: { group: c, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(sharedPool.problems).toEqual([]);
    const sharedRows = expandTopoConnections(lib, sharedPool);
    const aGroup = sharedPool.groups[0];
    const expectedUse = portUse(aGroup, sharedPool);
    for (const devId of ['a-1', 'a-2']) {
      const owner = new Map<string, number>();
      for (const r of sharedRows) {
        if (r.fromDeviceId === devId) owner.set(r.fromPoolPort, r.linkIndex);
      }
      expect(owner).toEqual(expectedUse.owner);
    }
    expect(sharedRows.filter((r) => r.linkName === 'a-c' && r.fromDeviceId === 'a-1').map((r) => r.fromPoolPort)).toEqual([
      'p3',
      'p4',
      'p5',
    ]);

    // 2. Round-robin modulo wrap-around (`fromDevs.length = 5 > toDevs.length = 2`) + explicit `map` ordering.
    const rrWrap = parseVirtual(`device_set_groups:
  src:
    role: worker
    count: 10
    partitions: [ { key: pod, count: 2 } ]
    ports: { up: u{1-2} }
  dst:
    role: agg
    count: 4
    partitions: [ { key: pod, count: 2 } ]
    ports: { down: d{1-6} }
topo:
  - name: rr-mapped
    from: { group: src, key: "\${pod}", ports: up }
    to:   { group: dst, key: "\${pod}", ports: down }
    map:
      - { from: ["2"], to: "2" }
      - { from: ["1"], to: "1" }
    pattern: { type: round-robin, per_pair: 2 }
`);
    expect(rrWrap.problems).toEqual([]);
    const rrRows = expandTopoConnections(lib, rrWrap);
    // `map` entry 1 (`pod 2` -> `pod 2`) runs before `map` entry 2 (`pod 1` -> `pod 1`).
    // Within pod 2: `src-6..src-10` (5 devices) wrap over `dst-3, dst-4` (`3, 4, 3, 4, 3`), consuming `d1..d6` on `dst-3`.
    expect(rrRows.slice(0, 10).map((r) => [r.fromDeviceId, r.toDeviceId, r.toPoolPort])).toEqual([
      ['src-6', 'dst-3', 'd1'],
      ['src-6', 'dst-3', 'd2'],
      ['src-7', 'dst-4', 'd1'],
      ['src-7', 'dst-4', 'd2'],
      ['src-8', 'dst-3', 'd3'],
      ['src-8', 'dst-3', 'd4'],
      ['src-9', 'dst-4', 'd3'],
      ['src-9', 'dst-4', 'd4'],
      ['src-10', 'dst-3', 'd5'],
      ['src-10', 'dst-3', 'd6'],
    ]);
    expect(rrRows[10].fromDeviceId).toBe('src-1');

    // 3. Unkeyed `from` paired with inner-keyed `to` (`plane` inside `su`) preserves destination member order `b-1..b-4`.
    const unkeyedFrom = parseVirtual(`device_set_groups:
  a: { role: spine, count: 1, ports: { down: p{1-4} } }
  b:
    role: tor
    count: 4
    partitions:
      - { key: su, count: 2 }
      - { key: plane, count: 2 }
    ports: { up: q1 }
topo:
  - { name: a-to-b, from: { group: a, ports: down }, to: { group: b, key: "\${plane}", ports: up }, pattern: { type: mesh, per_pair: 1 } }
`);
    const unkeyedRows = expandTopoConnections(lib, unkeyedFrom);
    expect(unkeyedRows.map((r) => [r.fromPoolPort, r.toDeviceId])).toEqual([
      ['p1', 'b-1'],
      ['p2', 'b-2'],
      ['p3', 'b-3'],
      ['p4', 'b-4'],
    ]);
  });
});

describe('expandTopoConnections — partitions, multi-key templates, filters, and same-group mesh', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());

  it('handles multi-key "${su}.${plane}" templates, uneven sizes, nested per keys, and <K>/<K>.index filters', () => {
    const v = parseVirtual(`device_set_groups:
  a:
    role: compute
    count: 12
    partitions:
      - { key: pod, count: 3 }
      - { key: rack, count: 2, per: [pod] }
    ports:
      up: p{1-4}
  b:
    role: leaf
    count: 6
    partitions:
      - { key: pod, count: 3 }
      - { key: rack, count: 2, per: [pod] }
    ports:
      down: q{1-4}
topo:
  - name: pod-rack-filtered
    from:
      group: a
      key: "\${pod}.\${rack}"
      filters: { pod: "1,3", rack.index: "2" }
      ports: up
    to:
      group: b
      key: "\${pod}.\${rack}"
      filters: { pod: "1,3" }
      ports: down
    pattern: { type: mesh, per_pair: 2 }
`);
    expect(v.problems).toEqual([]);
    const rows = expandTopoConnections(lib, v);
    // Pods 1 and 3 x 2 racks = 4 instances ("1.1", "1.2", "3.1", "3.2"); each has 1 filtered `a` (rack.index=2) x 1 `b` x per_pair 2 = 8 links.
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => [r.fromDeviceId, r.fromPoolPort, r.toDeviceId, r.toPoolPort])).toEqual([
      ['a-2', 'p1', 'b-1', 'q1'],
      ['a-2', 'p2', 'b-1', 'q2'],
      ['a-4', 'p1', 'b-2', 'q1'],
      ['a-4', 'p2', 'b-2', 'q2'],
      ['a-10', 'p1', 'b-5', 'q1'],
      ['a-10', 'p2', 'b-5', 'q2'],
      ['a-12', 'p1', 'b-6', 'q1'],
      ['a-12', 'p2', 'b-6', 'q2'],
    ]);

    // Uneven `sizes` partition with `<K>.index` range filter.
    const uneven = parseVirtual(`device_set_groups:
  s:
    role: worker
    count: 6
    partitions:
      - { key: zone, sizes: { alpha: 4, beta: 2 } }
    ports:
      nic: e{1-2}
  t:
    role: agg
    count: 2
    partitions:
      - { key: zone, sizes: { alpha: 1, beta: 1 } }
    ports:
      down: e{1-4}
topo:
  - name: zone-links
    from: { group: s, key: "\${zone}", filters: { zone.index: "1-2,4" }, ports: nic }
    to:   { group: t, key: "\${zone}", ports: down }
    pattern: { type: mesh, per_pair: 1 }
`);
    expect(uneven.problems).toEqual([]);
    const uRows = expandTopoConnections(lib, uneven);
    // alpha: indices 1, 2, 4 -> s-1, s-2, s-4 -> t-1; beta: indices 1, 2 -> s-5, s-6 -> t-2.
    expect(uRows.map((r) => [r.fromDeviceId, r.toDeviceId, r.toPoolPort])).toEqual([
      ['s-1', 't-1', 'e1'],
      ['s-2', 't-1', 'e2'],
      ['s-4', 't-1', 'e3'],
      ['s-5', 't-2', 'e1'],
      ['s-6', 't-2', 'e2'],
    ]);
  });

  it('emits undirected pairs (toIdx > fromIdx) for same-group mesh and matches VLink.links', () => {
    const v = parseVirtual(`device_set_groups:
  ring:
    role: peer
    count: 8
    partitions:
      - { key: island, count: 2 }
    ports:
      fabric: p{1-16}
topo:
  - name: intra-island
    from: { group: ring, key: "\${island}", ports: fabric }
    to:   { group: ring, key: "\${island}", ports: fabric }
    pattern: { type: mesh, per_pair: 2 }
`);
    expect(v.problems).toEqual([]);
    expect(v.links[0].links).toBe(24);
    const rows = expandTopoConnections(lib, v);
    expect(rows).toHaveLength(24);
    // Island 1 (`ring-1..ring-4`): 6 undirected pairs x 2 = 12; each peer uses 3x2 = 6 ports (`p1..p6`).
    for (const r of rows) {
      const fromNum = Number(r.fromDeviceId.split('-')[1]);
      const toNum = Number(r.toDeviceId.split('-')[1]);
      expect(toNum).toBeGreaterThan(fromNum);
    }
    const ring1Ports = rows
      .flatMap((r) => [
        ...(r.fromDeviceId === 'ring-1' ? [r.fromPoolPort] : []),
        ...(r.toDeviceId === 'ring-1' ? [r.toPoolPort] : []),
      ]);
    expect(ring1Ports).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });
});

describe('expandTopoConnections — SHIPPED_CATALOG hardware, custom deviceIds, filter, and CSV', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());
  const optic400 = 'osfp-400g-dr4';
  const optic800 = 'osfp-800g-2xdr4-ihs';
  const cableMpo = 'mpo12-smf';

  const v = parseVirtual(`device_set_groups:
  gpu:
    role: compute
    count: 2
    device_type: gpu-tray-1ru-lc-4x400g
    ports:
      be: { ports: be{1-2}, optic: ${optic400} }
  leaf:
    role: leaf
    count: 2
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "etp1{a,b}", optic: ${optic800} }
topo:
  - name: gpu-leaf
    from: { group: gpu, ports: be }
    to:   { group: leaf, ports: down }
    pattern: { type: mesh, per_pair: 1 }
    cable: ${cableMpo}
`);

  it('resolves unsplit and breakout cages, modes, optics, speeds, custom deviceIds, and link.cable override', () => {
    expect(v.problems).toEqual([]);
    const hw = topoHardware(lib, v);
    const customIds = new Map<string, readonly string[]>([
      ['gpu', ['dc1-gpu-01', 'dc1-gpu-02']],
      ['leaf', ['dc1-leaf-01', 'dc1-leaf-02']],
    ]);
    const rows = expandTopoConnections(lib, v, hw, customIds);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toEqual({
      index: 1,
      linkIndex: 0,
      linkName: 'gpu-leaf',
      fromDeviceId: 'dc1-gpu-01',
      fromGroup: 'gpu',
      fromRole: 'compute',
      fromPool: 'be',
      fromPoolPort: 'be1',
      fromDevicePort: 'be/1',
      fromMode: '1x400G',
      fromOpticId: optic400,
      fromOpticName: lib.optics.get(optic400)!.name,
      toDeviceId: 'dc1-leaf-01',
      toGroup: 'leaf',
      toRole: 'leaf',
      toPool: 'down',
      toPoolPort: 'etp1a',
      toDevicePort: 'osfp/1 (lane a)',
      toMode: '2x400G',
      toOpticId: optic800,
      toOpticName: lib.optics.get(optic800)!.name,
      speedGbps: 400,
      cableId: cableMpo,
      cableName: lib.cableMedia.get(cableMpo)!.name,
    });
    expect(rows[2].toDevicePort).toBe('osfp/1 (lane b)');

    // Overriding `link.cable` updates `cableId`/`cableName`,
    // and partial `deviceIds` entries fall back to `${group}-${i + 1}` for remaining members.
    const migratedLink: VLink = { ...v.links[0], cable: 'dac-800g' };
    const partialIds = new Map<string, readonly string[]>([['gpu', ['dc1-gpu-only-1']]]);
    const migratedRows = expandTopoConnections(lib, { ...v, links: [migratedLink] }, hw, partialIds);
    expect(migratedRows[0].cableId).toBe('dac-800g');
    expect(migratedRows[0].cableName).toBe(lib.cableMedia.get('dac-800g')!.name);
    expect(migratedRows.map((r) => r.fromDeviceId)).toEqual([
      'dc1-gpu-only-1',
      'dc1-gpu-only-1',
      'gpu-2',
      'gpu-2',
    ]);

    // Single-ended speed resolves when only one group has device_type; mismatched speeds yield undefined.
    const oneEnded = parseVirtual(`device_set_groups:
  ext: { role: wan, count: 1, ports: { p: e1 } }
  sw:  { role: spine, count: 1, device_type: switch-64x800g-osfp, ports: { p: etp1 } }
topo:
  - { name: ext-sw, from: { group: ext, ports: p }, to: { group: sw, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    const oneRows = expandTopoConnections(lib, oneEnded);
    expect([oneRows[0].fromDevicePort, oneRows[0].toDevicePort, oneRows[0].toMode, oneRows[0].speedGbps]).toEqual([
      '',
      'osfp/1',
      '1x800G',
      800,
    ]);

    const mismatch = parseVirtual(`device_set_groups:
  g:  { role: server, count: 1, device_type: gpu-tray-1ru-lc-4x400g, ports: { p: be1 } }
  sw: { role: spine,  count: 1, device_type: switch-64x800g-osfp,     ports: { p: etp1 } }
topo:
  - { name: bad-speed, from: { group: g, ports: p }, to: { group: sw, ports: p }, pattern: { type: mesh, per_pair: 1 } }
`);
    expect(expandTopoConnections(lib, mismatch)[0].speedGbps).toBeUndefined();
  });

  it('filters connections case-insensitively and serializes RFC-4180 CSV with escaped quotes, commas, and newlines', () => {
    const rows = expandTopoConnections(lib, v);
    expect(filterConnections(rows, '   ')).toHaveLength(4);
    expect(filterConnections(rows, 'LANE B').map((r) => r.index)).toEqual([3, 4]);
    expect(filterConnections(rows, 'gpu-2').map((r) => r.index)).toEqual([3, 4]);
    expect(filterConnections(rows, '2x400g')).toHaveLength(4);
    expect(filterConnections(rows, '400g')).toHaveLength(4);
    expect(filterConnections(rows, optic800.toUpperCase())).toHaveLength(4);
    expect(filterConnections(rows, 'mpo12')).toHaveLength(4);
    expect(filterConnections(rows, 'no-such-match')).toEqual([]);

    const trickyRow = {
      ...rows[0],
      linkName: 'tier, "alpha"',
      fromOpticName: 'Optic\nLine2',
      cableName: 'Patch, "SMF"',
    };
    const csv = connectionsToCsv([trickyRow]);
    const headerLine = csv.split('\n')[0];
    expect(headerLine).toBe(CONNECTION_CSV_HEADERS.join(','));
    expect(csv).toContain('1,"tier, ""alpha""",gpu-1,gpu,compute,be,be1,be/1,1x400G,"Optic\nLine2"');
    expect(csv).toContain(',400G,"Patch, ""SMF"""');
  });
});
