import type { Library } from '../library/library';
import type { BomLine } from '../bom/types';
import { bomColumns, SI_HEADER, type BomColumn } from '../bom/columns';
import type { PropertyDef } from '../properties/types';
import type { OpticDefinition } from '../optics/types';
import type { ItemVariant } from '../items/types';
import { traitsOf } from '../device/categories';
import { opticPowerW, variantLabel, withItemSpecs } from '../items/variants';
import { opticFitsCage } from '../ports/optic-match';
import { cageOf, portUse } from './ports';
import type { VGroup, VirtualTopo } from './virtual';

/**
 * Hardware assumed for the estimated BOM of a virtual topology. Saved with the topology (`Topology.bom`), never in its
 * YAML: device set groups stay logical.
 */
export interface TopoBomSettings {
  /** Group name -> device type (library device id) of its members. */
  devices?: Record<string, string>;
  /** `<group>.<pool>` (see `poolKey`) -> optic type in each cage the pool uses. */
  optics?: Record<string, string>;
  /** Item type id -> item (vendor product) bought for it; absent = its Generic item. */
  items?: Record<string, string>;
}

/** One pool of a group as the estimate counts it: per device (the port grid's fill), then over the group. */
export interface PoolEstimate {
  pool: string;
  /** Ports one device uses. */
  ports: number;
  /** Cages those ports sit in, one optic each; a cage shared with an earlier pool of the group counts there. */
  cages: number;
  /** Every device of the group uses exactly `ports`; false = an upper bound (uneven sets, filtered ends). */
  exact: boolean;
  opticId?: string;
  /** Optics over the group: devices x cages (0 without an optic). */
  optics: number;
}

export interface GroupEstimate {
  group: VGroup;
  /** Device type of the members, when set and in the library. */
  deviceId?: string;
  pools: PoolEstimate[];
}

export interface TopoBom {
  groups: GroupEstimate[];
  /** One line per device type and per optic type (groups without a device type: one line each). */
  lines: BomLine[];
  /** Links over every link spec whose count is known. */
  links: number;
}

/** Key of a pool's optic in `TopoBomSettings.optics`. */
export const poolKey = (group: string, pool: string) => `${group}.${pool}`;

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

/** Pools of a group in pool order, each with the ports and cages one device uses and the optics they take. */
function estimateGroup(lib: Library, v: VirtualTopo, s: TopoBomSettings, g: VGroup): GroupEstimate {
  const use = portUse(g, v);
  const counted = new Set<string>();
  const pools = Object.entries(g.poolNames).map(([pool, names]): PoolEstimate => {
    const used = names.filter((p) => use.owner.has(p));
    const cages = [...new Set(used.map(cageOf))].filter((c) => !counted.has(c));
    for (const c of cages) counted.add(c);
    const optic = lib.optics.get(s.optics?.[poolKey(g.name, pool)]);
    return {
      pool, ports: used.length, cages: cages.length, exact: poolExact(v, g, pool, used.length),
      opticId: optic?.id, optics: optic ? g.count * cages.length : 0,
    };
  });
  return { group: g, deviceId: lib.devices.get(s.devices?.[g.name])?.id, pools };
}

/**
 * Estimated BOM of a virtual topology: each group's devices as its device type, and one optic in every cage its
 * pools use. Lines merge by item type; the line's note is its derivation (`dt0 512 + t1 256`). Cables, housings,
 * racks and power need the physical layout and are not estimated.
 */
export function estimateTopoBom(lib: Library, v: VirtualTopo, s: TopoBomSettings): TopoBom {
  const groups = v.groups.map((g) => estimateGroup(lib, v, s, g));
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
      const o = lib.optics.get(p.opticId);
      if (!o) continue;
      const it = itemFor(lib, s, o.id);
      add({ key: `optic:${o.id}`, kind: 'optic', item: o.name, category: 'Optic', itemTypeId: o.id, pickKey: o.id, itemId: it?.id,
        vendorModel: variantLabel(it), qty: 0, unitW: opticPowerW(it, o), notes: [], properties: it?.properties },
      p.optics, `${g.name} ${p.pool} ${fmt(g.count)} × ${p.exact ? '' : '≤'}${fmt(p.cages)}`);
    }
  }
  for (const { line, parts } of merged.values()) line.notes = [parts.join(' + ')];
  return { groups, lines, links: v.links.reduce((n, l) => n + (l.links ?? 0), 0) };
}

/** Optics that fit a data cage of the device type (any optic when no device type is set). */
export function opticChoices(lib: Library, deviceId: string | undefined): OpticDefinition[] {
  const all = lib.optics.items();
  const d = lib.devices.get(deviceId);
  if (!d) return all;
  const cages = d.ports.filter((g) => g.role === 'data');
  return all.filter((o) => cages.some((g) => opticFitsCage(g, o)));
}

/**
 * Columns of the estimated BOM: the rack BOM's without "SI may adjust", Qty with thousands separators (topology
 * quantities run to tens of thousands), and the derivation after Qty.
 */
export function topoBomColumns(defs: readonly PropertyDef[]): BomColumn[] {
  const cols = bomColumns(defs).filter((c) => c.header !== SI_HEADER)
    .map((c) => (c.header === 'Qty' ? { ...c, cell: (l: BomLine) => fmt(l.qty) } : c));
  const at = cols.findIndex((c) => c.header === 'Qty') + 1;
  return [...cols.slice(0, at), { header: 'Derivation', cell: (l) => l.notes.join('; ') }, ...cols.slice(at)];
}
