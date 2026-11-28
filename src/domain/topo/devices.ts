import type { Partition, Problem, VGroup, VirtualTopo } from './virtual';

export const DEFAULT_ID_FORMAT = '{group.id}-{device.index}';

const MAX_PAD_WIDTH = 256;
const TOKEN_NAME_RE = /^[\w.-]+$/;
const WIDTH_SPEC_RE = /^\d+$/;

export type DeviceGroupInput = VGroup & {
  idFormat?: string;
};

export interface TopoContextInput extends Pick<VirtualTopo, 'name'> {
  dc?: { id?: string };
}

export interface DeviceTopoInput extends TopoContextInput {
  groups: readonly DeviceGroupInput[];
}

export interface TopoDevice {
  id: string;
  groupId: string;
  role: string;
  deviceIndex: number;
  setIndex: number;
  setDeviceIndex: number;
  partitionValues: Record<string, string>;
  partitionIndices: Record<string, number>;
}

export interface DeviceIdContext {
  dcId?: string;
  topologyId?: string;
  groupId: string;
  role: string;
  deviceIndex: number;
  setIndex: number;
  setDeviceIndex: number;
  partitionValues: Readonly<Record<string, string>>;
  partitionIndices: Readonly<Record<string, number>>;
}

export interface IdVariableHint {
  token: string;
  description: string;
  example: string;
}

export interface IdPreview {
  first?: string;
  last?: string;
  count: number;
}

type TemplateSegment =
  | { kind: 'literal'; text: string }
  | { kind: 'token'; raw: string; name: string; width?: number }
  | { kind: 'invalid'; raw: string; reason: string };

interface LeafCoord {
  deviceIndex: number;
  setIndex: number;
  setDeviceIndex: number;
  partitionValues: Record<string, string>;
  partitionIndices: Record<string, number>;
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function resolveDcId(topo?: TopoContextInput): string {
  const dcId = topo?.dc?.id;
  if (dcId !== undefined && dcId.trim().length > 0) return dcId;
  return topo?.name ?? '';
}

function effectiveIdFormat(idFormat: string | undefined): string {
  return idFormat !== undefined && idFormat.trim().length > 0 ? idFormat : DEFAULT_ID_FORMAT;
}

function isDeviceIdContext(value: unknown): value is DeviceIdContext {
  return typeof value === 'object' && value !== null && 'groupId' in value && 'deviceIndex' in value;
}

function parseIdTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const nextOpen = template.indexOf('{', cursor);
    const nextClose = template.indexOf('}', cursor);

    if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
      if (nextClose > cursor) {
        segments.push({ kind: 'literal', text: template.slice(cursor, nextClose) });
      }
      segments.push({
        kind: 'invalid',
        raw: '}',
        reason: `has unmatched "}"`,
      });
      cursor = nextClose + 1;
      continue;
    }

    if (nextOpen === -1) {
      segments.push({ kind: 'literal', text: template.slice(cursor) });
      break;
    }

    if (nextOpen > cursor) {
      segments.push({ kind: 'literal', text: template.slice(cursor, nextOpen) });
    }

    const closeIdx = template.indexOf('}', nextOpen + 1);
    const nestedOpen = template.indexOf('{', nextOpen + 1);

    if (closeIdx === -1) {
      segments.push({
        kind: 'invalid',
        raw: template.slice(nextOpen),
        reason: `has unclosed "{"`,
      });
      break;
    }

    if (nestedOpen !== -1 && nestedOpen < closeIdx) {
      segments.push({
        kind: 'invalid',
        raw: template.slice(nextOpen, nestedOpen),
        reason: `has unclosed "{"`,
      });
      cursor = nestedOpen;
      continue;
    }

    const raw = template.slice(nextOpen, closeIdx + 1);
    const inner = template.slice(nextOpen + 1, closeIdx);
    cursor = closeIdx + 1;

    if (inner.trim().length === 0) {
      segments.push({
        kind: 'invalid',
        raw,
        reason: `has empty "{}" placeholder`,
      });
      continue;
    }

    const colonIdx = inner.indexOf(':');
    if (colonIdx === -1) {
      if (!TOKEN_NAME_RE.test(inner)) {
        segments.push({
          kind: 'invalid',
          raw,
          reason: `has malformed placeholder "${raw}"`,
        });
      } else {
        segments.push({ kind: 'token', raw, name: inner });
      }
      continue;
    }

    const name = inner.slice(0, colonIdx);
    const widthSpec = inner.slice(colonIdx + 1);
    if (name.length === 0 || !TOKEN_NAME_RE.test(name)) {
      segments.push({
        kind: 'invalid',
        raw,
        reason: `has malformed placeholder "${raw}"`,
      });
      continue;
    }

    const parsedWidth = WIDTH_SPEC_RE.test(widthSpec) ? Number(widthSpec) : NaN;
    if (!Number.isSafeInteger(parsedWidth) || parsedWidth < 1 || parsedWidth > MAX_PAD_WIDTH) {
      segments.push({
        kind: 'invalid',
        raw,
        reason: `has invalid :width specifier ":${widthSpec}" in "${raw}" (expected a positive integer)`,
      });
      continue;
    }

    segments.push({ kind: 'token', raw, name, width: parsedWidth });
  }

  return segments;
}

function partitionCount(p: Partition): number {
  return p.sizes ? Object.keys(p.sizes).length : p.count;
}

function hasPerCycle(partitions: readonly Partition[], byKey: ReadonlyMap<string, Partition>): boolean {
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (key: string): boolean => {
    const cur = state.get(key);
    if (cur === 'visiting') return true;
    if (cur === 'done') return false;
    state.set(key, 'visiting');
    const part = byKey.get(key);
    for (const dep of part?.per ?? []) {
      if (!byKey.has(dep) || visit(dep)) return true;
    }
    state.set(key, 'done');
    return false;
  };

  for (const p of partitions) {
    if (visit(p.key)) return true;
  }
  return false;
}

function transitivePerKeys(p: Partition, byKey: ReadonlyMap<string, Partition>): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const collect = (part: Partition): void => {
    for (const depKey of part.per ?? []) {
      const dep = byKey.get(depKey);
      if (!dep || seen.has(depKey)) continue;
      collect(dep);
      if (!seen.has(depKey)) {
        seen.add(depKey);
        ordered.push(depKey);
      }
    }
  };
  collect(p);
  return ordered;
}

function derivedEqualSize(
  totalCount: number,
  p: Partition,
  byKey: ReadonlyMap<string, Partition>,
  deps: readonly string[] = p.per ?? [],
): number | undefined {
  if (!Number.isInteger(p.count) || p.count < 1) return undefined;
  let outer = 1;
  for (const k of deps) {
    const dep = byKey.get(k);
    if (!dep) return undefined;
    const depCount = partitionCount(dep);
    if (!Number.isInteger(depCount) || depCount < 1) return undefined;
    outer *= depCount;
  }
  const size = totalCount / outer / p.count;
  return Number.isInteger(size) && size >= 1 ? size : undefined;
}

/**
 * Decomposes `group.count` devices top-down across `group.partitions` in declaration order,
 * matching `diagram.ts:setSize` for equal `count`, uneven `sizes` in key order, and nested `per` keys.
 * Returns `[]` cleanly when `count` or partition sizes are non-positive or non-integer.
 */
function decomposeGroup(group: Pick<VGroup, 'count' | 'partitions'>): LeafCoord[] {
  const total = group.count;
  if (!Number.isInteger(total) || total <= 0) return [];

  const partitions = group.partitions;
  if (partitions.length === 0) {
    return Array.from({ length: total }, (_, idx) => ({
      deviceIndex: idx + 1,
      setIndex: 1,
      setDeviceIndex: idx + 1,
      partitionValues: {},
      partitionIndices: {},
    }));
  }

  const byKey = new Map<string, Partition>();
  for (const p of partitions) {
    if (!p.key || byKey.has(p.key)) return [];
    byKey.set(p.key, p);
  }
  if (hasPerCycle(partitions, byKey)) return [];

  const derivedSizes = new Map<string, number>();
  for (const p of partitions) {
    if (p.sizes) {
      const entries = Object.entries(p.sizes);
      if (entries.length === 0) return [];
      let sum = 0;
      for (const [k, v] of entries) {
        if (!k || !Number.isInteger(v) || v < 0) return [];
        sum += v;
      }
      let outer = 1;
      for (const depKey of p.per ?? []) {
        const dep = byKey.get(depKey);
        if (!dep) return [];
        const depCount = partitionCount(dep);
        if (!Number.isInteger(depCount) || depCount < 1) return [];
        outer *= depCount;
      }
      const expectedSum = total / outer;
      if (!Number.isInteger(expectedSum) || sum !== expectedSum) return [];
    } else {
      const directDerived = derivedEqualSize(total, p, byKey, p.per ?? []);
      const transDerived = derivedEqualSize(total, p, byKey, transitivePerKeys(p, byKey));
      const derived = transDerived ?? directDerived;
      if (derived === undefined || directDerived === undefined) return [];
      if (p.size !== 0 && (!Number.isInteger(p.size) || (p.size !== directDerived && p.size !== transDerived))) {
        return [];
      }
      derivedSizes.set(p.key, transDerived ?? directDerived);
    }
  }

  const rawCoords: Omit<LeafCoord, 'partitionIndices'>[] = [];
  let deviceIndex = 0;
  let setIndex = 0;
  let valid = true;

  const stepSize = (p: Partition, value: string, outerKey: string | undefined, outerSize: number): number => {
    if (!outerKey) {
      if (p.sizes) return hasOwn(p.sizes, value) ? p.sizes[value] : 0;
      return p.per?.length ? outerSize / p.count : (derivedSizes.get(p.key) ?? 0);
    }
    if (p.sizes) {
      const rawVal = hasOwn(p.sizes, value) ? p.sizes[value] : 0;
      if (p.per?.length) {
        let outer = 1;
        for (const depKey of transitivePerKeys(p, byKey)) {
          const dep = byKey.get(depKey);
          if (dep) outer *= partitionCount(dep);
        }
        const perScopeTotal = total / outer;
        return perScopeTotal > 0 ? (outerSize * rawVal) / perScopeTotal : NaN;
      }
      return (outerSize * rawVal) / total;
    }
    return p.count > 0 ? outerSize / p.count : NaN;
  };

  const walk = (level: number, outerKey: string | undefined, currentSize: number, values: Record<string, string>): void => {
    if (!valid) return;
    if (level === partitions.length) {
      if (!Number.isInteger(currentSize) || currentSize < 0) {
        valid = false;
        return;
      }
      if (currentSize === 0) return;
      setIndex += 1;
      for (let pos = 1; pos <= currentSize; pos += 1) {
        deviceIndex += 1;
        rawCoords.push({
          deviceIndex,
          setIndex,
          setDeviceIndex: pos,
          partitionValues: { ...values },
        });
      }
      return;
    }

    const p = partitions[level];
    const keys = p.sizes
      ? Object.keys(p.sizes)
      : Array.from({ length: p.count }, (_, idx) => String(idx + 1));

    let sliceSum = 0;
    for (const val of keys) {
      const nextSize = stepSize(p, val, outerKey, currentSize);
      if (!Number.isInteger(nextSize) || nextSize < 0) {
        valid = false;
        return;
      }
      sliceSum += nextSize;
      walk(level + 1, p.key, nextSize, { ...values, [p.key]: val });
      if (!valid) return;
    }
    if (sliceSum !== currentSize) {
      valid = false;
    }
  };

  walk(0, undefined, total, {});
  if (!valid || rawCoords.length !== total) return [];

  // Orthogonal partitions span all group members sharing `partitionValues[K]`; `per` partitions
  // hold inside each outer `per` set (matching `virtual.ts` `p.size` and `spec/10-topology-compiler.md`).
  const scopeKeysByPartition = new Map<string, string[]>(
    partitions.map((p) => [p.key, [...transitivePerKeys(p, byKey), p.key]]),
  );

  const counters = new Map<string, number>();
  return rawCoords.map((coord) => {
    const partitionIndices: Record<string, number> = {};
    for (const p of partitions) {
      const scopeKeys = scopeKeysByPartition.get(p.key) ?? [p.key];
      const scopeParts = scopeKeys.map((k) => `${k}=${coord.partitionValues[k] ?? ''}`);
      const bucketKey = `${p.key}\u0000${scopeParts.join('\u0000')}`;
      const next = (counters.get(bucketKey) ?? 0) + 1;
      counters.set(bucketKey, next);
      partitionIndices[p.key] = next;
    }
    return { ...coord, partitionIndices };
  });
}

function lookupTokenValue(name: string, ctx: DeviceIdContext, topo?: TopoContextInput): string | undefined {
  switch (name) {
    case 'dc.id':
      return ctx.dcId !== undefined ? ctx.dcId : resolveDcId(topo);
    case 'topology.id':
      return ctx.topologyId !== undefined ? ctx.topologyId : (topo?.name ?? '');
    case 'group.id':
      return ctx.groupId;
    case 'group.role':
      return ctx.role;
    case 'device.index':
      return String(ctx.deviceIndex);
    case 'set.index':
      return String(ctx.setIndex);
    case 'set.device.index':
      return String(ctx.setDeviceIndex);
    default: {
      if (hasOwn(ctx.partitionValues, name)) {
        return ctx.partitionValues[name];
      }
      if (name.endsWith('.index')) {
        const key = name.slice(0, -6);
        if (hasOwn(ctx.partitionIndices, key)) {
          return String(ctx.partitionIndices[key]);
        }
      }
      return undefined;
    }
  }
}

export function formatDeviceId(
  template: string | undefined,
  device: DeviceIdContext,
  topo?: TopoContextInput,
): string;
export function formatDeviceId(
  device: DeviceIdContext,
  template?: string,
  topo?: TopoContextInput,
): string;
export function formatDeviceId(
  first: string | DeviceIdContext | undefined,
  second?: DeviceIdContext | string,
  topo?: TopoContextInput,
): string {
  let ctx: DeviceIdContext;
  let rawTemplate: string | undefined;
  if (isDeviceIdContext(first)) {
    ctx = first;
    rawTemplate = typeof second === 'string' ? second : undefined;
  } else {
    if (!isDeviceIdContext(second)) return '';
    ctx = second;
    rawTemplate = first;
  }

  const segments = parseIdTemplate(effectiveIdFormat(rawTemplate));
  let out = '';
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      out += seg.text;
    } else if (seg.kind === 'invalid') {
      out += seg.raw;
    } else {
      const resolved = lookupTokenValue(seg.name, ctx, topo);
      if (resolved === undefined) {
        out += seg.raw;
      } else {
        out += seg.width !== undefined ? resolved.padStart(seg.width, '0') : resolved;
      }
    }
  }
  return out;
}

export function buildGroupDevices(group: DeviceGroupInput, topo: TopoContextInput = { name: '' }): TopoDevice[] {
  const coords = decomposeGroup(group);
  if (coords.length === 0) return [];

  const dcId = resolveDcId(topo);
  const topologyId = topo.name;
  const template = effectiveIdFormat(group.idFormat);

  return coords.map((coord) => {
    const id = formatDeviceId(template, {
      dcId,
      topologyId,
      groupId: group.name,
      role: group.role,
      deviceIndex: coord.deviceIndex,
      setIndex: coord.setIndex,
      setDeviceIndex: coord.setDeviceIndex,
      partitionValues: coord.partitionValues,
      partitionIndices: coord.partitionIndices,
    }, topo);

    return {
      id,
      groupId: group.name,
      role: group.role,
      deviceIndex: coord.deviceIndex,
      setIndex: coord.setIndex,
      setDeviceIndex: coord.setDeviceIndex,
      partitionValues: coord.partitionValues,
      partitionIndices: coord.partitionIndices,
    };
  });
}

export function buildTopoDevices(topo: DeviceTopoInput): TopoDevice[] {
  return topo.groups.flatMap((group) => buildGroupDevices(group, topo));
}

export function topoDeviceIdMap(topo: DeviceTopoInput): Map<string, string[]> {
  return new Map(topo.groups.map((group) => [group.name, buildGroupDevices(group, topo).map((d) => d.id)]));
}

function formatRangeExample(max: number): string {
  if (!Number.isInteger(max) || max <= 1) return '1';
  return `1..${max}`;
}

export function supportedIdVariables(
  group: Pick<VGroup, 'name' | 'role' | 'count' | 'partitions'>,
  topo?: TopoContextInput,
): IdVariableHint[] {
  const dcExample = resolveDcId(topo) || 'dc1';
  const topoExample = topo?.name || 'topology';
  const coords = decomposeGroup(group);

  const setCount = coords.length > 0 ? coords[coords.length - 1].setIndex : 1;
  const maxSetDeviceIndex = coords.reduce((max, c) => Math.max(max, c.setDeviceIndex), 1);

  const byKey = new Map(group.partitions.map((p) => [p.key, p]));
  const hints: IdVariableHint[] = [
    { token: '{dc.id}', description: 'DC id', example: dcExample },
    { token: '{topology.id}', description: 'Topology id', example: topoExample },
    { token: '{group.id}', description: 'Group id', example: group.name || 'group' },
    { token: '{group.role}', description: 'Device role', example: group.role || 'device' },
    { token: '{device.index}', description: 'Device index in group', example: formatRangeExample(group.count) },
    { token: '{set.index}', description: 'Leaf partition set index', example: formatRangeExample(setCount) },
    { token: '{set.device.index}', description: 'Device index in leaf set', example: formatRangeExample(maxSetDeviceIndex) },
  ];

  for (const p of group.partitions) {
    if (!p.key) continue;
    let valueExample: string;
    if (p.sizes) {
      const keys = Object.keys(p.sizes);
      valueExample = keys.length === 0
        ? '1'
        : keys.length <= 3
          ? keys.join(', ')
          : `${keys[0]}, ${keys[1]}, …, ${keys[keys.length - 1]}`;
    } else {
      valueExample = formatRangeExample(p.count);
    }

    let bucketMax = 1;
    if (coords.length > 0) {
      bucketMax = coords.reduce((max, c) => Math.max(max, c.partitionIndices[p.key] ?? 1), 1);
    } else if (p.sizes) {
      bucketMax = Math.max(1, ...Object.values(p.sizes));
    } else {
      bucketMax = (p.size > 0 && Number.isInteger(p.size) ? p.size : derivedEqualSize(group.count, p, byKey)) ?? 1;
    }

    hints.push(
      {
        token: `{${p.key}}`,
        description: `Partition ${p.key} value`,
        example: valueExample,
      },
      {
        token: `{${p.key}.index}`,
        description: `Device index in ${p.key} set`,
        example: formatRangeExample(bucketMax),
      },
    );
  }

  return hints;
}

export function previewGroupIds(devices: readonly Pick<TopoDevice, 'id'>[]): IdPreview {
  if (devices.length === 0) return { count: 0 };
  return {
    first: devices[0].id,
    last: devices[devices.length - 1].id,
    count: devices.length,
  };
}

function allowedTokenNamesForGroup(group: Pick<VGroup, 'partitions'>): Set<string> {
  const names = new Set<string>([
    'dc.id',
    'topology.id',
    'group.id',
    'group.role',
    'device.index',
    'set.index',
    'set.device.index',
  ]);
  for (const p of group.partitions) {
    if (!p.key) continue;
    names.add(p.key);
    names.add(`${p.key}.index`);
  }
  return names;
}

export function deviceIdProblems(topo: DeviceTopoInput): Problem[] {
  const problems: Problem[] = [];
  const validGroupDevices: { groupName: string; devices: TopoDevice[] }[] = [];

  for (const group of topo.groups) {
    const rawFormat = effectiveIdFormat(group.idFormat);
    const segments = parseIdTemplate(rawFormat);
    const allowed = allowedTokenNamesForGroup(group);
    const reportedUnknown = new Set<string>();
    let groupHasFormatError = false;

    for (const seg of segments) {
      if (seg.kind === 'invalid') {
        problems.push({ message: `group ${group.name}: id_format "${rawFormat}" ${seg.reason}` });
        groupHasFormatError = true;
      } else if (seg.kind === 'token' && !allowed.has(seg.name) && !reportedUnknown.has(seg.name)) {
        reportedUnknown.add(seg.name);
        problems.push({ message: `group ${group.name}: id_format "${rawFormat}" uses unknown variable "{${seg.name}}"` });
        groupHasFormatError = true;
      }
    }

    if (groupHasFormatError) continue;

    const devices = buildGroupDevices(group, topo);
    validGroupDevices.push({ groupName: group.name, devices });

    const counts = new Map<string, number>();
    for (const dev of devices) {
      counts.set(dev.id, (counts.get(dev.id) ?? 0) + 1);
    }
    const intraDups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    if (intraDups.length > 0) {
      const extra = intraDups.length > 1 ? ` (and ${intraDups.length - 1} more)` : '';
      problems.push({
        message: `group ${group.name}: duplicate device id "${intraDups[0]}"${extra}`,
      });
    }
  }

  const groupsById = new Map<string, string[]>();
  for (const { groupName, devices } of validGroupDevices) {
    const uniqueInGroup = new Set(devices.map((d) => d.id));
    for (const id of uniqueInGroup) {
      const owners = groupsById.get(id);
      if (owners) owners.push(groupName);
      else groupsById.set(id, [groupName]);
    }
  }

  const crossGroupBuckets = new Map<string, { groups: string[]; ids: string[] }>();
  for (const [id, owners] of groupsById) {
    if (owners.length < 2) continue;
    const key = owners.join('\u0000');
    const bucket = crossGroupBuckets.get(key);
    if (bucket) bucket.ids.push(id);
    else crossGroupBuckets.set(key, { groups: owners, ids: [id] });
  }

  for (const { groups, ids } of crossGroupBuckets.values()) {
    const extra = ids.length > 1 ? ` (and ${ids.length - 1} more)` : '';
    problems.push({
      message: `duplicate device id "${ids[0]}" across groups ${groups.join(', ')}${extra}`,
    });
  }

  return problems;
}
