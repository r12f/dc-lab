import type { Library } from '../library/library';
import type { BomLine } from '../bom/types';
import { bomColumns, SI_HEADER, type BomColumn } from '../bom/columns';
import type { PropertyDef } from '../properties/types';
import type { ItemVariant } from '../items/types';
import type { CableEnd } from '../optics/types';
import { traitsOf } from '../device/categories';
import { cablePowerWPerEnd, opticPowerW, variantLabel, withItemSpecs } from '../items/variants';
import { cablesPerPort } from '../ports/optic-match';
import { orientLinkCable, poolSpeeds, topoHardware, type GroupHardware } from './hardware';
import { portUse } from './ports';
import { portNumber, type VGroup, type VLink, type VirtualTopo } from './virtual';

/**
 * Procurement picks of a topology's estimated BOM, saved with the topology (`Topology.bom`). The hardware itself
 * (device types, pool optics and link cables) is in the YAML.
 */
export interface TopoBomSettings {
  /** Item type id -> item (vendor product) bought for it; absent = its Generic item. */
  items?: Record<string, string>;
}

/** One pool of a group as the estimate counts it: per device (the port grid's fill), then over the group. */
export interface PoolEstimate {
  pool: string;
  /** Ports one device uses. */
  ports: number;
  /** Speed of the pool's ports on the device type (one speed). */
  speedGbps?: number;
  /** Device ports (cages) those ports sit in (`etp3a`, `etp3b`: one); a cage shared with an earlier pool counts there. */
  cages: number;
  /** Every device of the group uses exactly `ports`; false = an upper bound (uneven sets, filtered ends). */
  exact: boolean;
  /** The pool's optic in those cages: per device, and over the group. */
  optics: { opticId: string; perDevice: number; total: number }[];
}

export interface GroupEstimate {
  group: VGroup;
  /** Device type of the members, when set and in the library. */
  deviceId?: string;
  /** Name of the breakout profile matched to the group's ports (none fits: undefined). */
  profileName?: string;
  pools: PoolEstimate[];
}

/** Cables of one link spec: one cable type joining both ends. */
export interface CableEstimate {
  link: VLink;
  cableId: string;
  /** Links one cable carries (oriented end connectors x lanes each holds); < 1 = a link takes several cables. */
  perCable: number;
  qty: number;
}

/** One link spec's row in the per-link Cable BOM (one entry per `VLink` in `virtual.links` order). */
export interface CableBomRow {
  link: string;
  fromGroup: string;
  fromRole: string;
  fromDeviceType?: string;
  fromPool: string;
  fromMode: string;
  fromOpticId?: string;
  toGroup: string;
  toRole: string;
  toDeviceType?: string;
  toPool: string;
  toMode: string;
  toOpticId?: string;
  links?: number;
  cableId?: string;
  pickKey?: string;
  itemId?: string;
  vendorModel: string;
  perCable?: number;
  qty: number;
  derivation: string;
  unitW: number;
  totalW: number;
}

export interface TopoBom {
  groups: GroupEstimate[];
  cables: CableEstimate[];
  cableBom: CableBomRow[];
  /** One line per device type, optic type and cable type (groups without a device type: one line each). */
  lines: BomLine[];
  /** Links over every link spec whose count is known. */
  links: number;
}

export const CABLE_BOM_CSV_HEADERS = [
  'Link',
  'From Group',
  'From Role',
  'From Device Type',
  'From Pool',
  'From Mode',
  'From Optic',
  'To Group',
  'To Role',
  'To Device Type',
  'To Pool',
  'To Mode',
  'To Optic',
  'Links',
  'Cable',
  'Vendor / Model (PN)',
  'Qty',
  'Derivation',
  'Power/pcs',
  'Total W',
] as const;

const fmt = (n: number) => n.toLocaleString('en-US');

/** The item bought for an item type: the topology's pick when it is of that type, else the type's Generic item. */
function itemFor(lib: Library, s: TopoBomSettings, typeId: string): ItemVariant | undefined {
  const picked = lib.variants.get(s.items?.[typeId]);
  return picked && picked.itemId === typeId ? picked : lib.variants.defaultOf(typeId);
}

/**
 * Whether every device of the group uses exactly `ports` of the pool: the ports all devices would use at that rate
 * equal the ports the link specs take (each link takes one port at each end).
 */
function poolExact(v: VirtualTopo, g: VGroup, pool: string, ports: number): boolean {
  let taken = 0;
  for (const l of v.links) {
    for (const e of [l.from, l.to]) {
      if (e.group !== g.name || e.ports !== pool) continue;
      if (l.links === undefined) return false;
      taken += l.links;
    }
  }
  return taken === g.count * ports;
}

/** The cage a pool port sits in: its device port, else (no device type or no fitting profile) its name without the lane. */
function cageKey(hw: GroupHardware, name: string): string | undefined {
  const p = portNumber(name);
  return hw.ports.get(name)?.cage ?? (p && `${p.prefix}${p.n}`);
}

/** Pools of a group in pool order: the ports one device uses, the cages they sit in, the optic in them. */
function estimateGroup(lib: Library, v: VirtualTopo, g: VGroup, hw: GroupHardware): GroupEstimate {
  const use = portUse(g, v);
  const counted = new Set<string>();
  const pools = Object.entries(g.poolNames).map(([pool, names]): PoolEstimate => {
    const used = names.filter((p) => use.owner.has(p));
    let cages = 0;
    for (const p of used) {
      const c = cageKey(hw, p);
      if (c === undefined || counted.has(c)) continue;
      counted.add(c);
      cages++;
    }
    const speeds = poolSpeeds(g, hw, pool);
    const opticId = g.poolOptics[pool];
    return {
      pool, ports: used.length, ...(speeds.length === 1 ? { speedGbps: speeds[0] } : {}), cages,
      exact: poolExact(v, g, pool, used.length),
      optics: opticId && lib.optics.get(opticId) && cages ? [{ opticId, perDevice: cages, total: cages * g.count }] : [],
    };
  });
  return { group: g, deviceId: hw.device?.id, profileName: hw.profile?.name, pools };
}

function poolMode(g: VGroup | undefined, ghw: GroupHardware | undefined, pool: string): string {
  if (!g || !ghw) return '';
  const modes = [...new Set((g.poolNames[pool] ?? []).map((n) => ghw.ports.get(n)?.mode).filter((m): m is string => !!m))];
  return modes.join('/');
}

/**
 * Links one cable carries at an oriented link end: the cable's connectors on that side x the lanes each connector
 * holds (cage fanout / connectors per cage: 2x400G on a 2xDR4 module = 1, 8x100G = 4, 1x800G = 1/2).
 */
function linksPerOrientedEnd(
  lib: Library,
  g: VGroup | undefined,
  ghw: GroupHardware | undefined,
  pool: string,
  cableEnd: CableEnd,
): number | undefined {
  const port = g ? (g.poolNames[pool] ?? []).map((n) => ghw?.ports.get(n)).find((p) => !!p) : undefined;
  if (!port || !g) return undefined;
  const optic = lib.optics.get(g.poolOptics[pool]);
  return (cableEnd.count * port.fanout) / cablesPerPort(port.group, optic);
}

/**
 * Cables per link spec: computed directly from `link.cable` using the oriented end connector count and `fanout / cablesPerPort`.
 */
function estimateCables(lib: Library, v: VirtualTopo, hw: Map<string, GroupHardware>): CableEstimate[] {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const out: CableEstimate[] = [];
  for (const l of v.links) {
    if (l.links === undefined || !l.cable) continue;
    const cable = lib.cableMedia.get(l.cable);
    if (!cable) continue;
    const { fromEnd, toEnd } = orientLinkCable(lib, v, l, cable, hw);
    const ga = byName.get(l.from.group);
    const gb = byName.get(l.to.group);
    const fromPer = linksPerOrientedEnd(lib, ga, hw.get(l.from.group), l.from.ports, fromEnd);
    const toPer = linksPerOrientedEnd(lib, gb, hw.get(l.to.group), l.to.ports, toEnd);
    const perCable =
      fromPer !== undefined && toPer !== undefined
        ? Math.min(fromPer, toPer)
        : (fromPer ?? toPer ?? Math.max(1, Math.min(fromEnd.count, toEnd.count)));
    out.push({ link: l, cableId: cable.id, perCable, qty: Math.ceil(l.links / perCable) });
  }
  return out;
}

/** How a cable quantity follows from the links: `compute-dt0 720`, `dt0-t1 32,768 ÷ 4`, `x 64 × 2`. */
function cableDerivation(c: CableEstimate): string {
  const per = c.perCable === 1 ? '' : c.perCable > 1 ? ` ÷ ${fmt(c.perCable)}` : ` × ${fmt(1 / c.perCable)}`;
  return `${c.link.name} ${fmt(c.link.links ?? 0)}${per}`;
}

function buildCableBom(
  lib: Library,
  v: VirtualTopo,
  hw: Map<string, GroupHardware>,
  cables: readonly CableEstimate[],
  s: TopoBomSettings,
): CableBomRow[] {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const estByLinkIdx = new Map(cables.map((c) => [c.link.index, c]));

  return v.links.map((l): CableBomRow => {
    const ga = byName.get(l.from.group);
    const gb = byName.get(l.to.group);
    const fromOpticId = ga?.poolOptics[l.from.ports];
    const toOpticId = gb?.poolOptics[l.to.ports];
    const est = estByLinkIdx.get(l.index);
    const media = l.cable ? lib.cableMedia.get(l.cable) : undefined;
    const it = media ? itemFor(lib, s, media.id) : undefined;
    const unitW = media ? cablePowerWPerEnd(it, media) * (media.ends.a.count + media.ends.b.count) : 0;
    const qty = est?.qty ?? 0;

    return {
      link: l.name,
      fromGroup: l.from.group,
      fromRole: ga?.role ?? '',
      ...(ga?.deviceType ? { fromDeviceType: ga.deviceType } : {}),
      fromPool: l.from.ports,
      fromMode: poolMode(ga, hw.get(l.from.group), l.from.ports),
      ...(fromOpticId ? { fromOpticId } : {}),
      toGroup: l.to.group,
      toRole: gb?.role ?? '',
      ...(gb?.deviceType ? { toDeviceType: gb.deviceType } : {}),
      toPool: l.to.ports,
      toMode: poolMode(gb, hw.get(l.to.group), l.to.ports),
      ...(toOpticId ? { toOpticId } : {}),
      ...(l.links !== undefined ? { links: l.links } : {}),
      ...(l.cable ? { cableId: l.cable } : {}),
      ...(media ? { pickKey: media.id } : {}),
      ...(it ? { itemId: it.id } : {}),
      vendorModel: media ? variantLabel(it) : '',
      ...(est ? { perCable: est.perCable } : {}),
      qty,
      derivation: est ? cableDerivation(est) : '',
      unitW,
      totalW: unitW * qty,
    };
  });
}

/**
 * Estimated BOM of a virtual topology: each group's devices as its `device_type`; per pool, its optic in every cage
 * its used ports sit in (cage = the port's number); per link spec, the cable the link sets. Lines merge by item
 * type; the line's note is its derivation (`dt0 512 + t1 256`). Housings, trunks, racks and power need the physical
 * layout and are not estimated.
 */
export function estimateTopoBom(lib: Library, v: VirtualTopo, s: TopoBomSettings): TopoBom {
  const hw = topoHardware(lib, v);
  const groups = v.groups.map((g) => estimateGroup(lib, v, g, hw.get(g.name)!));
  const cables = estimateCables(lib, v, hw);
  const cableBom = buildCableBom(lib, v, hw, cables, s);
  const lines: BomLine[] = [];
  const merged = new Map<string, { line: BomLine; parts: string[] }>();
  const add = (line: BomLine, qty: number, part: string) => {
    let m = merged.get(line.key);
    if (!m) { m = { line, parts: [] }; merged.set(line.key, m); lines.push(line); }
    m.line.qty += qty;
    m.parts.push(part);
  };
  for (const { group: g, deviceId } of groups) {
    const d = lib.devices.get(deviceId);
    if (!d) {
      add({ key: `group:${g.name}`, kind: 'device', item: `${g.role || g.name} (no device type)`, category: '', vendorModel: '', qty: 0, unitW: 0, notes: [] },
        g.count, `${g.name} ${fmt(g.count)}`);
      continue;
    }
    const it = itemFor(lib, s, d.id);
    add({ key: `device:${d.id}`, kind: 'device', item: d.name, category: traitsOf(d.category).label, itemTypeId: d.id, pickKey: d.id,
      itemId: it?.id, vendorModel: variantLabel(it), qty: 0, unitW: withItemSpecs(d, it).power.typicalW, notes: [], properties: it?.properties },
    g.count, `${g.name} ${fmt(g.count)}`);
  }
  for (const { group: g, pools } of groups) {
    for (const p of pools) {
      for (const { opticId, perDevice, total } of p.optics) {
        const o = lib.optics.get(opticId)!;
        const it = itemFor(lib, s, o.id);
        add({ key: `optic:${o.id}`, kind: 'optic', item: o.name, category: 'Optic', itemTypeId: o.id, pickKey: o.id, itemId: it?.id,
          vendorModel: variantLabel(it), qty: 0, unitW: opticPowerW(it, o), notes: [], properties: it?.properties },
        total, `${g.name} ${p.pool} ${fmt(g.count)} × ${p.exact ? '' : '≤'}${fmt(perDevice)}`);
      }
    }
  }
  for (const c of cables) {
    const m = lib.cableMedia.get(c.cableId)!;
    const it = itemFor(lib, s, m.id);
    // Active cables (AEC / AOC) draw power at every plug.
    add({ key: `cable:${m.id}`, kind: 'cable', item: m.name, category: 'Cable', itemTypeId: m.id, pickKey: m.id, itemId: it?.id,
      vendorModel: variantLabel(it), qty: 0, unitW: cablePowerWPerEnd(it, m) * (m.ends.a.count + m.ends.b.count), notes: [], properties: it?.properties },
    c.qty, cableDerivation(c));
  }
  for (const { line, parts } of merged.values()) line.notes = [parts.join(' + ')];
  return { groups, cables, cableBom, lines, links: v.links.reduce((n, l) => n + (l.links ?? 0), 0) };
}

function escapeCsvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export per-link `CableBomRow` entries as RFC-4180 CSV. */
export function cableBomToCsv(lib: Library, rows: readonly CableBomRow[]): string {
  const out: string[] = [CABLE_BOM_CSV_HEADERS.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    const fromDevName = r.fromDeviceType ? (lib.devices.get(r.fromDeviceType)?.name ?? r.fromDeviceType) : '';
    const fromOpticName = r.fromOpticId ? (lib.optics.get(r.fromOpticId)?.name ?? r.fromOpticId) : '';
    const toDevName = r.toDeviceType ? (lib.devices.get(r.toDeviceType)?.name ?? r.toDeviceType) : '';
    const toOpticName = r.toOpticId ? (lib.optics.get(r.toOpticId)?.name ?? r.toOpticId) : '';
    const cableName = r.cableId ? (lib.cableMedia.get(r.cableId)?.name ?? r.cableId) : '';
    out.push(
      [
        r.link,
        r.fromGroup,
        r.fromRole,
        fromDevName,
        r.fromPool,
        r.fromMode,
        fromOpticName,
        r.toGroup,
        r.toRole,
        toDevName,
        r.toPool,
        r.toMode,
        toOpticName,
        r.links ?? '',
        cableName,
        r.vendorModel,
        r.qty,
        r.derivation,
        r.unitW,
        r.totalW,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return out.join('\n');
}

/** Header of the per-item power column (typical W of one piece, from the picked item). */
export const POWER_PCS_HEADER = 'Power/pcs';

/**
 * Columns of the estimated BOM: the rack BOM's without "SI may adjust", Qty with thousands separators (topology
 * quantities run to tens of thousands), the derivation after Qty, and Power/pcs before Total W (Qty x Power/pcs).
 */
export function topoBomColumns(defs: readonly PropertyDef[]): BomColumn[] {
  const cols = bomColumns(defs).filter((c) => c.header !== SI_HEADER)
    .map((c) => (c.header === 'Qty' ? { ...c, cell: (l: BomLine) => fmt(l.qty) } : c));
  const qty = cols.findIndex((c) => c.header === 'Qty') + 1;
  const total = cols.findIndex((c) => c.header === 'Total W');
  return [
    ...cols.slice(0, qty),
    { header: 'Derivation', cell: (l) => l.notes.join('; ') },
    ...cols.slice(qty, total),
    { header: POWER_PCS_HEADER, numeric: true, power: true, cell: (l) => (l.unitW ? l.unitW : '') },
    ...cols.slice(total),
  ];
}
