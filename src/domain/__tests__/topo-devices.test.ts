import { describe, expect, it } from 'vitest';
import { parseVirtual, type VGroup } from '../topo/virtual';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import {
  DEFAULT_ID_FORMAT,
  buildGroupDevices,
  buildTopoDevices,
  deviceIdProblems,
  formatDeviceId,
  previewGroupIds,
  supportedIdVariables,
  topoDeviceIdMap,
  type DeviceGroupInput,
  type DeviceTopoInput,
} from '../topo/devices';

function makeGroup(overrides: Partial<DeviceGroupInput> & Pick<VGroup, 'name' | 'role' | 'count'>): DeviceGroupInput {
  return {
    partitions: [],
    poolOptics: {},
    pools: {},
    poolSlots: {},
    poolNames: {},
    ...overrides,
  };
}

describe('topology device ID generator — partition coordinate decomposition', () => {
  it('expands an unpartitioned group as a single leaf set with 1..count indices', () => {
    const mgmt = makeGroup({ name: 'mgmt', role: 'oob', count: 3 });
    const devices = buildGroupDevices(mgmt, { name: 'pod-net' });

    expect(DEFAULT_ID_FORMAT).toBe('{group.id}-{device.index}');
    expect(devices).toEqual([
      {
        id: 'mgmt-1',
        groupId: 'mgmt',
        role: 'oob',
        deviceIndex: 1,
        setIndex: 1,
        setDeviceIndex: 1,
        partitionValues: {},
        partitionIndices: {},
      },
      {
        id: 'mgmt-2',
        groupId: 'mgmt',
        role: 'oob',
        deviceIndex: 2,
        setIndex: 1,
        setDeviceIndex: 2,
        partitionValues: {},
        partitionIndices: {},
      },
      {
        id: 'mgmt-3',
        groupId: 'mgmt',
        role: 'oob',
        deviceIndex: 3,
        setIndex: 1,
        setDeviceIndex: 3,
        partitionValues: {},
        partitionIndices: {},
      },
    ]);
  });

  it('decomposes single and multi-partition orthogonal groups in SAMPLE_TOPOLOGY', () => {
    const virtual = parseVirtual(SAMPLE_TOPOLOGY);
    const allDevices = buildTopoDevices(virtual);
    expect(allDevices).toHaveLength(64 + 32 + 16 + 8);

    const idMap = topoDeviceIdMap(virtual);
    expect(idMap.get('server')?.slice(0, 3)).toEqual(['server-1', 'server-2', 'server-3']);
    expect(idMap.get('t2')).toHaveLength(8);

    const serverGroup = virtual.groups.find((g) => g.name === 'server')!;
    const servers = buildGroupDevices(serverGroup, virtual);
    expect(servers).toHaveLength(64);
    expect(servers[0]).toMatchObject({
      id: 'server-1',
      deviceIndex: 1,
      setIndex: 1,
      setDeviceIndex: 1,
      partitionValues: { su: '1' },
      partitionIndices: { su: 1 },
    });
    expect(servers[15]).toMatchObject({
      id: 'server-16',
      deviceIndex: 16,
      setIndex: 1,
      setDeviceIndex: 16,
      partitionValues: { su: '1' },
      partitionIndices: { su: 16 },
    });
    expect(servers[16]).toMatchObject({
      id: 'server-17',
      deviceIndex: 17,
      setIndex: 2,
      setDeviceIndex: 1,
      partitionValues: { su: '2' },
      partitionIndices: { su: 1 },
    });

    const t0Group = virtual.groups.find((g) => g.name === 't0')!;
    const t0s = buildGroupDevices(t0Group, virtual);
    expect(t0s).toHaveLength(32);
    // Declaration order: su (1..4) outer, plane (1..8) inner -> 32 leaf sets of 1 device each.
    expect(t0s[0]).toMatchObject({
      id: 't0-1',
      deviceIndex: 1,
      setIndex: 1,
      setDeviceIndex: 1,
      partitionValues: { su: '1', plane: '1' },
      partitionIndices: { su: 1, plane: 1 },
    });
    expect(t0s[7]).toMatchObject({
      id: 't0-8',
      deviceIndex: 8,
      setIndex: 8,
      setDeviceIndex: 1,
      partitionValues: { su: '1', plane: '8' },
      partitionIndices: { su: 8, plane: 1 },
    });
    // Device 9 is su=2, plane=1 -> 1st device in su=2, 2nd device across the group with plane=1.
    expect(t0s[8]).toMatchObject({
      id: 't0-9',
      deviceIndex: 9,
      setIndex: 9,
      setDeviceIndex: 1,
      partitionValues: { su: '2', plane: '1' },
      partitionIndices: { su: 1, plane: 2 },
    });
    expect(t0s[31]).toMatchObject({
      id: 't0-32',
      deviceIndex: 32,
      setIndex: 32,
      setDeviceIndex: 1,
      partitionValues: { su: '4', plane: '8' },
      partitionIndices: { su: 8, plane: 4 },
    });
  });

  it('decomposes uneven named sizes in key declaration order and orthogonal sub-partitions', () => {
    const v = parseVirtual(`device_set_groups:
  gpu:
    role: compute
    count: 12
    partitions:
      - { key: zone, sizes: { east: 8, west: 4 } }
      - { key: plane, count: 2 }
    ports: { nic: p1 }
`);
    expect(v.problems).toEqual([]);
    const devices = buildGroupDevices(
      { ...v.groups[0], idFormat: '{zone}-{plane}-{set.index}:{set.device.index}/{zone.index}.{plane.index}' },
      v,
    );
    expect(devices).toHaveLength(12);
    // east (8) splits into plane 1 (4) + plane 2 (4); west (4) splits into plane 1 (2) + plane 2 (2).
    expect(devices.map((d) => d.id)).toEqual([
      'east-1-1:1/1.1',
      'east-1-1:2/2.2',
      'east-1-1:3/3.3',
      'east-1-1:4/4.4',
      'east-2-2:1/5.1',
      'east-2-2:2/6.2',
      'east-2-2:3/7.3',
      'east-2-2:4/8.4',
      'west-1-3:1/1.5',
      'west-1-3:2/2.6',
      'west-2-4:1/3.5',
      'west-2-4:2/4.6',
    ]);
  });

  it('decomposes nested per partitions and scopes per-key indices inside each outer set', () => {
    const v = parseVirtual(`device_set_groups:
  srv:
    role: server
    count: 12
    partitions:
      - { key: pod, count: 3 }
      - { key: rack, count: 2, per: [pod] }
    ports: { nic: p1 }
`);
    expect(v.problems).toEqual([]);
    const devices = buildGroupDevices(
      { ...v.groups[0], idFormat: 'p{pod}-r{rack}-u{rack.index}-pidx{pod.index}' },
      v,
    );
    expect(devices).toHaveLength(12);
    expect(devices.map((d) => d.id)).toEqual([
      'p1-r1-u1-pidx1',
      'p1-r1-u2-pidx2',
      'p1-r2-u1-pidx3',
      'p1-r2-u2-pidx4',
      'p2-r1-u1-pidx1',
      'p2-r1-u2-pidx2',
      'p2-r2-u1-pidx3',
      'p2-r2-u2-pidx4',
      'p3-r1-u1-pidx1',
      'p3-r1-u2-pidx2',
      'p3-r2-u1-pidx3',
      'p3-r2-u2-pidx4',
    ]);
    expect(devices[4]).toMatchObject({
      deviceIndex: 5,
      setIndex: 3,
      setDeviceIndex: 1,
      partitionValues: { pod: '2', rack: '1' },
      partitionIndices: { pod: 1, rack: 1 },
    });

    // Multi-level nested `per` chain (region -> pod -> rack)
    const multiLevel = parseVirtual(`device_set_groups:
  leaf:
    role: leaf
    count: 24
    partitions:
      - { key: region, count: 2 }
      - { key: pod, count: 3, per: [region] }
      - { key: rack, count: 2, per: [region, pod] }
    ports: { up: p1 }
`);
    expect(multiLevel.problems).toEqual([]);
    const multiDevs = buildGroupDevices(
      { ...multiLevel.groups[0], idFormat: 'reg{region}-pod{pod}-r{rack}-i{rack.index}' },
      multiLevel,
    );
    expect(multiDevs).toHaveLength(24);
    expect(multiDevs[0].id).toBe('reg1-pod1-r1-i1');
    expect(multiDevs[23]).toMatchObject({
      id: 'reg2-pod3-r2-i2',
      deviceIndex: 24,
      setIndex: 12,
      setDeviceIndex: 2,
      partitionValues: { region: '2', pod: '3', rack: '2' },
      partitionIndices: { region: 12, pod: 4, rack: 2 },
    });
  });

  it('returns an empty array cleanly when count or partition sizes are invalid or non-integer', () => {
    const nonDivisible = parseVirtual(`device_set_groups:
  bad: { role: tor, count: 10, partitions: [ { key: su, count: 3 } ], ports: { p: e1 } }
`).groups[0];
    expect(buildGroupDevices(nonDivisible)).toEqual([]);

    const incompatibleOrthogonal = parseVirtual(`device_set_groups:
  bad2:
    role: tor
    count: 12
    partitions:
      - { key: su, count: 4 }
      - { key: plane, count: 6 }
    ports: { p: e1 }
`).groups[0];
    expect(buildGroupDevices(incompatibleOrthogonal)).toEqual([]);

    const badSizesSum = parseVirtual(`device_set_groups:
  bad3: { role: tor, count: 10, partitions: [ { key: su, sizes: { a: 4, b: 4 } } ], ports: { p: e1 } }
`).groups[0];
    expect(buildGroupDevices(badSizesSum)).toEqual([]);

    const cyclicPer = makeGroup({
      name: 'cyc',
      role: 'tor',
      count: 4,
      partitions: [
        { key: 'a', count: 2, size: 0, per: ['b'] },
        { key: 'b', count: 2, size: 0, per: ['a'] },
      ],
    });
    expect(buildGroupDevices(cyclicPer)).toEqual([]);
    expect(buildGroupDevices(makeGroup({ name: 'zero', role: 'tor', count: 0 }))).toEqual([]);
    expect(buildGroupDevices(makeGroup({ name: 'float', role: 'tor', count: 2.5 }))).toEqual([]);
  });
});

describe('topology device ID generator — template formatting & dc.id fallback', () => {
  it('supports :N zero-padding and leaves longer values intact', () => {
    const v = parseVirtual(SAMPLE_TOPOLOGY);
    const t0 = v.groups.find((g) => g.name === 't0')!;
    const devices = buildGroupDevices(
      { ...t0, idFormat: '{dc.id}-{group.role}{set.index:3}-s{su:2}p{plane:2}-d{set.device.index:2}' },
      { ...v, dc: { id: 'iad1' } },
    );
    expect(devices[0].id).toBe('iad1-tor001-s01p01-d01');
    expect(devices[31].id).toBe('iad1-tor032-s04p08-d01');

    // Values wider than :N are never truncated; both formatDeviceId call signatures work.
    expect(
      formatDeviceId(
        '{group.id:2}-{device.index:4}',
        {
          groupId: 'spine',
          role: 'spine',
          deviceIndex: 12,
          setIndex: 1,
          setDeviceIndex: 12,
          partitionValues: {},
          partitionIndices: {},
        },
        { name: 'fabric-a' },
      ),
    ).toBe('spine-0012');

    expect(
      formatDeviceId(
        {
          groupId: 'spine',
          role: 'spine',
          deviceIndex: 12345,
          setIndex: 1,
          setDeviceIndex: 1,
          partitionValues: {},
          partitionIndices: {},
        },
        '{topology.id}:{device.index:3}',
        { name: 'fabric-a' },
      ),
    ).toBe('fabric-a:12345');
  });

  it('resolves {dc.id} from topo.dc.id when non-empty, falling back to topo.name or empty string', () => {
    const g = makeGroup({ name: 'leaf', role: 'leaf', count: 1, idFormat: '{dc.id}|{topology.id}|{group.id}' });

    expect(buildGroupDevices(g, { name: 'backend-v1', dc: { id: 'sjc2' } })[0].id).toBe('sjc2|backend-v1|leaf');
    expect(buildGroupDevices(g, { name: 'backend-v1', dc: { id: '' } })[0].id).toBe('backend-v1|backend-v1|leaf');
    expect(buildGroupDevices(g, { name: 'backend-v1' })[0].id).toBe('backend-v1|backend-v1|leaf');
    expect(buildGroupDevices(g, { name: '', dc: { id: '' } })[0].id).toBe('||leaf');
  });
});

describe('topology device ID generator — variable hints & preview', () => {
  it('returns ordered built-in and dynamic partition variable hints with accurate examples', () => {
    const v = parseVirtual(SAMPLE_TOPOLOGY);
    const t0 = v.groups.find((g) => g.name === 't0')!;
    const vars = supportedIdVariables(t0, { name: v.name, dc: { id: 'dc1' } });

    expect(vars.map((x) => x.token)).toEqual([
      '{dc.id}',
      '{topology.id}',
      '{group.id}',
      '{group.role}',
      '{device.index}',
      '{set.index}',
      '{set.device.index}',
      '{su}',
      '{su.index}',
      '{plane}',
      '{plane.index}',
    ]);

    const byToken = new Map(vars.map((x) => [x.token, x]));
    expect(byToken.get('{dc.id}')?.example).toBe('dc1');
    expect(byToken.get('{topology.id}')?.example).toBe('example-backend');
    expect(byToken.get('{group.id}')?.example).toBe('t0');
    expect(byToken.get('{group.role}')?.example).toBe('tor');
    expect(byToken.get('{device.index}')?.example).toBe('1..32');
    expect(byToken.get('{set.index}')?.example).toBe('1..32');
    expect(byToken.get('{set.device.index}')?.example).toBe('1');
    expect(byToken.get('{su}')?.example).toBe('1..4');
    expect(byToken.get('{su.index}')?.example).toBe('1..8');
    expect(byToken.get('{plane}')?.example).toBe('1..8');
    expect(byToken.get('{plane.index}')?.example).toBe('1..4');

    // Unpartitioned group omits partition-specific tokens.
    const unpartVars = supportedIdVariables(makeGroup({ name: 'core', role: 'core', count: 4 }));
    expect(unpartVars.map((x) => x.token)).toEqual([
      '{dc.id}',
      '{topology.id}',
      '{group.id}',
      '{group.role}',
      '{device.index}',
      '{set.index}',
      '{set.device.index}',
    ]);
  });

  it('computes previewGroupIds for empty, singleton, and multi-device lists', () => {
    expect(previewGroupIds([])).toEqual({ count: 0 });
    expect(previewGroupIds([{ id: 'spine-01' }])).toEqual({
      first: 'spine-01',
      last: 'spine-01',
      count: 1,
    });

    const v = parseVirtual(SAMPLE_TOPOLOGY);
    const servers = buildGroupDevices(
      { ...v.groups[0], idFormat: '{dc.id}-srv-{su:2}-{su.index:2}' },
      { ...v, dc: { id: 'dc1' } },
    );
    expect(previewGroupIds(servers)).toEqual({
      first: 'dc1-srv-01-01',
      last: 'dc1-srv-04-16',
      count: 64,
    });
  });
});

describe('topology device ID generator — validation (deviceIdProblems)', () => {
  it('passes cleanly on SAMPLE_TOPOLOGY with default and valid custom idFormats', () => {
    const v = parseVirtual(SAMPLE_TOPOLOGY);
    expect(deviceIdProblems(v)).toEqual([]);

    const custom: DeviceTopoInput = {
      name: v.name,
      dc: { id: 'dc1' },
      groups: v.groups.map((g) => ({
        ...g,
        idFormat: '{dc.id}-{group.id}-{set.index:2}-{set.device.index:2}',
      })),
    };
    expect(deviceIdProblems(custom)).toEqual([]);
  });

  it('reports unclosed/malformed braces, invalid :width specifiers, and unknown variables', () => {
    const topo: DeviceTopoInput = {
      name: 'val-test',
      groups: [
        makeGroup({ name: 'g_unclosed', role: 'tor', count: 2, idFormat: 'tor-{device.index' }),
        makeGroup({ name: 'g_unmatched', role: 'tor', count: 2, idFormat: 'tor-device.index}' }),
        makeGroup({ name: 'g_nested', role: 'tor', count: 2, idFormat: '{group.id-{device.index}' }),
        makeGroup({ name: 'g_empty', role: 'tor', count: 2, idFormat: 'tor-{}' }),
        makeGroup({ name: 'g_zero_width', role: 'tor', count: 2, idFormat: 'tor-{device.index:0}' }),
        makeGroup({ name: 'g_bad_width', role: 'tor', count: 2, idFormat: 'tor-{device.index:abc}' }),
        makeGroup({
          name: 'g_unknown',
          role: 'tor',
          count: 4,
          partitions: [{ key: 'su', count: 2, size: 2 }],
          idFormat: '{group.id}-{su}-{rack}-{plane.index:2}',
        }),
      ],
    };

    const messages = deviceIdProblems(topo).map((p) => p.message);
    expect(messages.some((m) => m.includes('g_unclosed') && m.includes('unclosed'))).toBe(true);
    expect(messages.some((m) => m.includes('g_unmatched') && m.includes('unmatched'))).toBe(true);
    expect(messages.some((m) => m.includes('g_nested') && m.includes('unclosed'))).toBe(true);
    expect(messages.some((m) => m.includes('g_empty') && m.includes('{}'))).toBe(true);
    expect(messages.some((m) => m.includes('g_zero_width') && m.includes(':0'))).toBe(true);
    expect(messages.some((m) => m.includes('g_bad_width') && m.includes(':abc'))).toBe(true);
    expect(messages.some((m) => m.includes('g_unknown') && m.includes('rack'))).toBe(true);
    expect(messages.some((m) => m.includes('g_unknown') && m.includes('plane.index'))).toBe(true);
  });

  it('detects both intra-group and cross-group duplicate device IDs', () => {
    const intraTopo: DeviceTopoInput = {
      name: 'intra-dup',
      groups: [
        makeGroup({
          name: 'server',
          role: 'server',
          count: 6,
          partitions: [{ key: 'su', count: 2, size: 3 }],
          // Missing within-su differentiator -> "server-su1" and "server-su2" each repeat 3 times.
          idFormat: '{group.id}-su{su}',
        }),
      ],
    };
    const intraProblems = deviceIdProblems(intraTopo).map((p) => p.message);
    expect(intraProblems).toHaveLength(1);
    expect(intraProblems[0]).toContain('server');
    expect(intraProblems[0]).toContain('server-su1');

    const crossTopo: DeviceTopoInput = {
      name: 'cross-dup',
      groups: [
        makeGroup({
          name: 'tor_east',
          role: 'tor',
          count: 2,
          idFormat: '{group.role}-{device.index:2}',
        }),
        makeGroup({
          name: 'tor_west',
          role: 'tor',
          count: 2,
          idFormat: '{group.role}-{device.index:2}',
        }),
      ],
    };
    const crossProblems = deviceIdProblems(crossTopo).map((p) => p.message);
    expect(crossProblems).toHaveLength(1);
    expect(crossProblems[0]).toContain('tor-01');
    expect(crossProblems[0]).toContain('tor_east');
    expect(crossProblems[0]).toContain('tor_west');
  });
});
