import type { Library } from '../library/library';
import type { BomLine } from '../bom/types';
import { bomColumns, SI_HEADER, type BomColumn } from '../bom/columns';
import type { PropertyDef } from '../properties/types';
import type { ItemVariant } from '../items/types';
import type { CableEnd, CableMedia } from '../optics/types';
import { traitsOf } from '../device/categories';
import { cablePowerWPerEnd, opticPowerW, variantLabel, withItemSpecs } from '../items/variants';
import { connectorsMate } from '../optics/connectors';
import { moduleFits } from '../ports/form-factors';
import { cablesPerPort } from '../ports/optic-match';
import { poolSpeeds, topoHardware, type GroupHardware } from './hardware';
import { portUse } from './ports';
import { portNumber, type VEnd, type VGroup, type VLink, type VirtualTopo } from './virtual';

/**
 * Procurement picks of a topology's estimated BOM, saved with the topology (`Topology.bom`). The hardware itself
 * (device types, pool optics and cables) is in the YAML.
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
  /** Cable type the pool's ports take, when set. */
  cableId?: string;
}

export interface GroupEstimate {
  group: VGroup;
  /** Device type of the members, when set and in the library. */
  deviceId?: string;
  /** Name of the breakout profile matched to the group's ports (none fits: undefined). */
  profileName?: string;
  pools: PoolEstimate[];
}

/** Cables of one link spec: one cable type, joining both ends or plugged into one end. */
export interface CableEstimate {
  link: VLink;
  cableId: string;
  /** The end the cable is counted at (its group); both ends take it: undefined. */
  end?: string;
  /** Links one cable carries (its connectors at that end x lanes each holds); < 1 = a link takes several cables. */
  perCable: number;
  qty: number;
}

export interface TopoBom {
  groups: GroupEstimate[];
  cables: CableEstimate[];
  /** One line per device type, optic type and cable type (groups without a device type: one line each). */
  lines: BomLine[];
  /** Links over every link spec whose count is known. */
  links: number;
}

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
      ...(g.poolCables[pool] ? { cableId: g.poolCables[pool] } : {}),
    };
  });
  return { group: g, deviceId: hw.device?.id, profileName: hw.profile?.name, pools };
}

/**
 * Links one cable carries at a link end: the cable's connectors on that side (the end that mates the pool's optic,
 * or plugs into the cage) x the lanes each optic connector holds (cage fanout / connectors per cage: 2x400G on a
 * 2xDR4 module = 1, 8x100G = 4, 1x800G = 1/2). Without a device type, one lane per connector.
 */
function linksPerCable(lib: Library, g: VGroup, hw: GroupHardware | undefined, pool: string, cable: CableMedia): number {
  const optic = lib.optics.get(g.poolOptics[pool]);
  const port = (g.poolNames[pool] ?? []).map((n) => hw?.ports.get(n)).find((p) => !!p);
  const connector = optic?.fiberConnector.replace(/^\d+x\s*/i, '');
  const fits = (e: CableEnd) => (connector ? connectorsMate(e.connector, connector) : !!port && moduleFits(port.group.formFactor, e.connector));
  const end = fits(cable.ends.a) || !fits(cable.ends.b) ? cable.ends.a : cable.ends.b;
  if (!port) return end.count;
  return (end.count * port.fanout) / (optic ? cablesPerPort(port.group, optic) : 1);
}

/**
 * Cables per link spec: a cable type both ends take is one cable joining them; different types (patch cords to a
 * panel at each end) count at each end. Qty = links / links per cable at that end.
 */
function estimateCables(lib: Library, v: VirtualTopo, hw: Map<string, GroupHardware>): CableEstimate[] {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const out: CableEstimate[] = [];
  for (const l of v.links) {
    if (l.links === undefined) continue;
    const at = (e: VEnd) => { const g = byName.get(e.group); return g && { g, cable: lib.cableMedia.get(g.poolCables[e.ports]), pool: e.ports }; };
    const ends = [at(l.from), at(l.to)];
    const shared = ends[0]?.cable && ends[0].cable.id === ends[1]?.cable?.id;
    for (const [i, e] of ends.entries()) {
      if (!e?.cable || (shared && i > 0)) continue;
      const perCable = linksPerCable(lib, e.g, hw.get(e.g.name), e.pool, e.cable);
      out.push({ link: l, cableId: e.cable.id, ...(shared ? {} : { end: e.g.name }), perCable, qty: Math.ceil(l.links / perCable) });
    }
  }
  return out;
}

/** How a cable quantity follows from the links: `compute-dt0 720`, `dt0-t1 32,768 ÷ 4`, `x 64 × 2`. */
function cableDerivation(c: CableEstimate): string {
  const per = c.perCable === 1 ? '' : c.perCable > 1 ? ` ÷ ${fmt(c.perCable)}` : ` × ${fmt(1 / c.perCable)}`;
  return `${c.link.name}${c.end ? ` (${c.end} end)` : ''} ${fmt(c.link.links ?? 0)}${per}`;
}

/**
 * Estimated BOM of a virtual topology: each group's devices as its `device_type`; per pool, its optic in every cage
 * its used ports sit in (cage = the port's number); per link spec, the cables its pools take. Lines merge by item
 * type; the line's note is its derivation (`dt0 512 + t1 256`). Housings, trunks, racks and power need the physical
 * layout and are not estimated.
 */
export function estimateTopoBom(lib: Library, v: VirtualTopo, s: TopoBomSettings): TopoBom {
  const hw = topoHardware(lib, v);
  const groups = v.groups.map((g) => estimateGroup(lib, v, g, hw.get(g.name)!));
  const cables = estimateCables(lib, v, hw);
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
  return { groups, cables, lines, links: v.links.reduce((n, l) => n + (l.links ?? 0), 0) };
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
