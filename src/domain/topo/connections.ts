import type { Library } from '../library/library';
import { formatGbps } from '../units';
import { topoHardware, type DevicePort, type GroupHardware } from './hardware';
import { keyVars, portNumber, type VEnd, type VGroup, type VLink, type VirtualTopo } from './virtual';

/** One concrete point-to-point port connection expanded from a virtual topology link spec. */
export interface PortConnection {
  /** 1-based connection number across the topology. */
  index: number;
  /** 0-based position of the generating link spec in `topo`. */
  linkIndex: number;
  linkName: string;
  fromDeviceId: string;
  fromGroup: string;
  fromRole: string;
  fromPool: string;
  fromPoolPort: string;
  /** Physical cage/lane on the source device (e.g. `"osfp/1"` or `"osfp/1 (lane a)"`), or `""` when unresolved. */
  fromDevicePort: string;
  fromMode: string;
  fromOpticId: string;
  fromOpticName: string;
  toDeviceId: string;
  toGroup: string;
  toRole: string;
  toPool: string;
  toPoolPort: string;
  /** Physical cage/lane on the destination device (e.g. `"osfp/1"` or `"osfp/1 (lane a)"`), or `""` when unresolved. */
  toDevicePort: string;
  toMode: string;
  toOpticId: string;
  toOpticName: string;
  /** Resolved link speed when both ends agree or a single end resolves a speed. */
  speedGbps: number | undefined;
  cableId: string;
  cableName: string;
}

export const CONNECTION_CSV_HEADERS = [
  'Index',
  'Link',
  'From Device',
  'From Group',
  'From Role',
  'From Pool',
  'From Pool Port',
  'From Device Port',
  'From Mode',
  'From Optic',
  'To Device',
  'To Group',
  'To Role',
  'To Pool',
  'To Pool Port',
  'To Device Port',
  'To Mode',
  'To Optic',
  'Speed',
  'Cable',
] as const;

interface GroupMember {
  readonly memberIdx: number;
  readonly values: Readonly<Record<string, string>>;
  readonly indices: Readonly<Record<string, number>>;
}

/** Decompose `g.count` members across `g.partitions` into partition values and 1-based within-set indices. */
function decomposeGroupMembers(g: VGroup): GroupMember[] {
  if (!Number.isInteger(g.count) || g.count <= 0) return [];
  if (!g.partitions.length) {
    return Array.from({ length: g.count }, (_, memberIdx) => ({ memberIdx, values: {}, indices: {} }));
  }

  const rawValues: Record<string, string>[] = [];
  const walk = (depth: number, subCount: number, acc: Record<string, string>): boolean => {
    if (!Number.isInteger(subCount) || subCount < 0) return false;
    if (depth === g.partitions.length) {
      for (let i = 0; i < subCount; i++) rawValues.push({ ...acc });
      return true;
    }
    const p = g.partitions[depth];
    if (p.sizes) {
      const entries = Object.entries(p.sizes);
      const totalSizes = entries.reduce((sum, [, sz]) => sum + sz, 0);
      if (totalSizes <= 0 || totalSizes !== g.count) return false;
      for (const [val, sz] of entries) {
        const childCount = depth === 0 ? sz : (sz * subCount) / totalSizes;
        if (!walk(depth + 1, childCount, { ...acc, [p.key]: val })) return false;
      }
      return true;
    }
    if (!Number.isInteger(p.count) || p.count <= 0) return false;
    const childCount = subCount / p.count;
    for (let i = 1; i <= p.count; i++) {
      if (!walk(depth + 1, childCount, { ...acc, [p.key]: String(i) })) return false;
    }
    return true;
  };

  if (!walk(0, g.count, {}) || rawValues.length !== g.count) {
    return Array.from({ length: g.count }, (_, memberIdx) => ({ memberIdx, values: {}, indices: {} }));
  }

  const bucketCounts = new Map<string, number>();
  return rawValues.map((values, memberIdx) => {
    const indices: Record<string, number> = {};
    for (const p of g.partitions) {
      const scopeParts = p.per?.length ? p.per.map((pk) => values[pk] ?? '') : [];
      const bucketKey = `${p.key}\u0000${scopeParts.join('\u0000')}\u0000${values[p.key] ?? ''}`;
      const nextIdx = (bucketCounts.get(bucketKey) ?? 0) + 1;
      bucketCounts.set(bucketKey, nextIdx);
      indices[p.key] = nextIdx;
    }
    return { memberIdx, values, indices };
  });
}

function matchesFilterExpr(val: string, expr: string): boolean {
  return expr.split(',').some((rawPart) => {
    const part = rawPart.trim();
    if (!part) return false;
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      if (!/^\d+$/.test(val)) return false;
      const num = Number(val);
      return num >= Number(range[1]) && num <= Number(range[2]);
    }
    return part === val;
  });
}

function passesFilters(member: GroupMember, filters: Readonly<Record<string, string>>): boolean {
  for (const [k, expr] of Object.entries(filters)) {
    const val = k.endsWith('.index')
      ? (member.indices[k.slice(0, -6)] !== undefined ? String(member.indices[k.slice(0, -6)]) : undefined)
      : member.values[k];
    if (val === undefined || !matchesFilterExpr(val, expr)) return false;
  }
  return true;
}

function evaluateInstanceKey(member: GroupMember, keyTemplate: string): string | undefined {
  const vars = keyVars(keyTemplate);
  if (!vars.length) return undefined;
  let missing = false;
  const rendered = keyTemplate.replace(/\$\{([\w.]+)\}/g, (_match, varName: string) => {
    if (varName.endsWith('.index')) {
      const idx = member.indices[varName.slice(0, -6)];
      if (idx === undefined) {
        missing = true;
        return '';
      }
      return String(idx);
    }
    const val = member.values[varName];
    if (val === undefined) {
      missing = true;
      return '';
    }
    return val;
  });
  return missing ? undefined : rendered;
}

function groupIntoInstances(members: readonly GroupMember[], end: VEnd): Map<string, GroupMember[]> {
  const filtered = members.filter((m) => passesFilters(m, end.filters));
  const instances = new Map<string, GroupMember[]>();
  if (!end.key) {
    if (filtered.length) instances.set('', filtered);
    return instances;
  }
  for (const m of filtered) {
    const k = evaluateInstanceKey(m, end.key);
    if (k === undefined) continue;
    const list = instances.get(k);
    if (list) list.push(m);
    else instances.set(k, [m]);
  }
  return instances;
}

function pairInstances(
  link: VLink,
  fromInstances: ReadonlyMap<string, GroupMember[]>,
  toInstances: ReadonlyMap<string, GroupMember[]>,
): [GroupMember[], GroupMember[]][] {
  const pairs: [GroupMember[], GroupMember[]][] = [];
  if (link.map.length > 0) {
    for (const entry of link.map) {
      const toDevs = link.to.key ? toInstances.get(entry.to) : toInstances.get('');
      if (!toDevs?.length) continue;
      for (const fromKey of entry.from) {
        const fromDevs = link.from.key ? fromInstances.get(fromKey) : fromInstances.get('');
        if (fromDevs?.length) pairs.push([fromDevs, toDevs]);
      }
    }
    return pairs;
  }

  if (link.from.key && link.to.key) {
    for (const [k, fromDevs] of fromInstances) {
      const toDevs = toInstances.get(k);
      if (fromDevs.length && toDevs?.length) pairs.push([fromDevs, toDevs]);
    }
    return pairs;
  }

  if (link.from.key && !link.to.key) {
    const allTo = toInstances.get('');
    if (!allTo?.length) return pairs;
    for (const [, fromDevs] of fromInstances) {
      if (fromDevs.length) pairs.push([fromDevs, allTo]);
    }
    return pairs;
  }

  const allFrom = fromInstances.get('');
  const allTo = link.to.key
    ? [...toInstances.values()].flat().sort((a, b) => a.memberIdx - b.memberIdx)
    : toInstances.get('');
  if (allFrom?.length && allTo?.length) pairs.push([allFrom, allTo]);
  return pairs;
}

function formatPhysicalPort(poolPort: string, dp: DevicePort | undefined): string {
  if (!dp) return '';
  if (dp.fanout <= 1) return dp.cage;
  const parsed = portNumber(poolPort);
  const lane = parsed?.lane !== undefined ? String.fromCharCode(97 + parsed.lane) : '';
  return lane ? `${dp.cage} (lane ${lane})` : dp.cage;
}

/**
 * Expand all virtual topology link specs into concrete end-to-end physical port connections.
 */
export function expandTopoConnections(
  lib: Library,
  virtual: VirtualTopo,
  hardware: ReadonlyMap<string, GroupHardware> = topoHardware(lib, virtual),
  deviceIds?: ReadonlyMap<string, readonly string[]>,
): PortConnection[] {
  const groupByName = new Map(virtual.groups.map((g) => [g.name, g]));
  const membersByGroup = new Map(virtual.groups.map((g) => [g.name, decomposeGroupMembers(g)]));
  const portCursors = new Map<string, Map<string, number>[]>();
  for (const g of virtual.groups) {
    portCursors.set(
      g.name,
      Array.from({ length: Math.max(0, g.count) }, () => new Map<string, number>()),
    );
  }

  const nextPoolPort = (group: VGroup, memberIdx: number, pool: string): string => {
    const devCursors = portCursors.get(group.name)?.[memberIdx];
    const names = group.poolNames[pool] ?? [];
    if (!devCursors) return '';
    const at = devCursors.get(pool) ?? 0;
    devCursors.set(pool, at + 1);
    return at < names.length ? names[at] : '';
  };

  const deviceIdOf = (group: VGroup, memberIdx: number): string => {
    const custom = deviceIds?.get(group.name)?.[memberIdx];
    return custom ? custom : `${group.name}-${memberIdx + 1}`;
  };

  const connections: PortConnection[] = [];

  for (const link of virtual.links) {
    const fromGroup = groupByName.get(link.from.group);
    const toGroup = groupByName.get(link.to.group);
    if (!fromGroup || !toGroup || link.perPair <= 0) continue;

    const fromMembers = membersByGroup.get(fromGroup.name) ?? [];
    const toMembers = membersByGroup.get(toGroup.name) ?? [];
    const fromInstances = groupIntoInstances(fromMembers, link.from);
    const toInstances = groupIntoInstances(toMembers, link.to);
    const instancePairs = pairInstances(link, fromInstances, toInstances);
    if (!instancePairs.length) continue;

    const fromHw = hardware.get(fromGroup.name);
    const toHw = hardware.get(toGroup.name);
    const fromOpticId = fromGroup.poolOptics[link.from.ports] ?? '';
    const fromOpticName = fromOpticId ? (lib.optics.get(fromOpticId)?.name ?? fromOpticId) : '';
    const toOpticId = toGroup.poolOptics[link.to.ports] ?? '';
    const toOpticName = toOpticId ? (lib.optics.get(toOpticId)?.name ?? toOpticId) : '';
    const cableId = link.cable ?? '';
    const cableName = cableId ? (lib.cableMedia.get(cableId)?.name ?? cableId) : '';
    const sameGroup = fromGroup.name === toGroup.name;

    const emitPair = (fromDev: GroupMember, toDev: GroupMember): void => {
      for (let k = 0; k < link.perPair; k++) {
        const fromPoolPort = nextPoolPort(fromGroup, fromDev.memberIdx, link.from.ports);
        const toPoolPort = nextPoolPort(toGroup, toDev.memberIdx, link.to.ports);
        const fromDp = fromPoolPort ? fromHw?.ports.get(fromPoolPort) : undefined;
        const toDp = toPoolPort ? toHw?.ports.get(toPoolPort) : undefined;
        const speedGbps =
          fromDp && toDp
            ? fromDp.speedGbps === toDp.speedGbps
              ? fromDp.speedGbps
              : undefined
            : (fromDp?.speedGbps ?? toDp?.speedGbps);

        connections.push({
          index: connections.length + 1,
          linkIndex: link.index,
          linkName: link.name,
          fromDeviceId: deviceIdOf(fromGroup, fromDev.memberIdx),
          fromGroup: fromGroup.name,
          fromRole: fromGroup.role,
          fromPool: link.from.ports,
          fromPoolPort,
          fromDevicePort: formatPhysicalPort(fromPoolPort, fromDp),
          fromMode: fromDp?.mode ?? '',
          fromOpticId,
          fromOpticName,
          toDeviceId: deviceIdOf(toGroup, toDev.memberIdx),
          toGroup: toGroup.name,
          toRole: toGroup.role,
          toPool: link.to.ports,
          toPoolPort,
          toDevicePort: formatPhysicalPort(toPoolPort, toDp),
          toMode: toDp?.mode ?? '',
          toOpticId,
          toOpticName,
          speedGbps,
          cableId,
          cableName,
        });
      }
    };

    for (const [fromDevs, toDevs] of instancePairs) {
      if (!toDevs.length) continue;
      switch (link.pattern) {
        case 'mesh': {
          for (const fromDev of fromDevs) {
            for (const toDev of toDevs) {
              if (sameGroup && toDev.memberIdx <= fromDev.memberIdx) continue;
              emitPair(fromDev, toDev);
            }
          }
          break;
        }
        case 'round-robin': {
          for (let i = 0; i < fromDevs.length; i++) {
            emitPair(fromDevs[i], toDevs[i % toDevs.length]);
          }
          break;
        }
        default: {
          const _exhaustive: never = link.pattern;
          void _exhaustive;
        }
      }
    }
  }

  return connections;
}

/** Case-insensitive substring filter across link, device, group, role, port, mode, speed, optic, and cable fields. */
export function filterConnections(rows: readonly PortConnection[], query: string): PortConnection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  const has = (s: string): boolean => s.length > 0 && s.toLowerCase().includes(q);
  return rows.filter((r) => {
    const speedLabel = r.speedGbps !== undefined ? formatGbps(r.speedGbps) : '';
    return (
      has(r.linkName) ||
      has(r.fromDeviceId) ||
      has(r.fromGroup) ||
      has(r.fromRole) ||
      has(r.fromPool) ||
      has(r.fromPoolPort) ||
      has(r.fromDevicePort) ||
      has(r.fromMode) ||
      has(r.fromOpticId) ||
      has(r.fromOpticName) ||
      has(r.toDeviceId) ||
      has(r.toGroup) ||
      has(r.toRole) ||
      has(r.toPool) ||
      has(r.toPoolPort) ||
      has(r.toDevicePort) ||
      has(r.toMode) ||
      has(r.toOpticId) ||
      has(r.toOpticName) ||
      has(speedLabel) ||
      has(r.cableId) ||
      has(r.cableName)
    );
  });
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize connections to RFC-4180 CSV. */
export function connectionsToCsv(rows: readonly PortConnection[]): string {
  const lines: string[] = [CONNECTION_CSV_HEADERS.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.index,
        r.linkName,
        r.fromDeviceId,
        r.fromGroup,
        r.fromRole,
        r.fromPool,
        r.fromPoolPort,
        r.fromDevicePort,
        r.fromMode,
        r.fromOpticName,
        r.toDeviceId,
        r.toGroup,
        r.toRole,
        r.toPool,
        r.toPoolPort,
        r.toDevicePort,
        r.toMode,
        r.toOpticName,
        r.speedGbps !== undefined ? formatGbps(r.speedGbps) : '',
        r.cableName,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
