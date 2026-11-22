import type { Library } from '../library/library';
import type { BomLine } from '../bom/types';
import { bomColumns, SI_HEADER, type BomColumn } from '../bom/columns';
import type { PropertyDef } from '../properties/types';
import type { ItemVariant } from '../items/types';
import { traitsOf } from '../device/categories';
import { opticPowerW, variantLabel, withItemSpecs } from '../items/variants';
import { groupHardware, poolSpeeds } from './hardware';
import { portUse } from './ports';
import type { VGroup, VirtualTopo } from './virtual';

/**
 * Procurement picks of a topology's estimated BOM, saved with the topology (`Topology.bom`). The hardware itself
 * (device type, port map, optics) is in the YAML.
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
  /** Speed of the pool's ports on the device type (one speed), from the port map. */
  speedGbps?: number;
  /** Device ports (cages) those ports sit in; a cage shared with an earlier pool counts there. No port map: undefined. */
  cages?: number;
  /** Every device of the group uses exactly `ports`; false = an upper bound (uneven sets, filtered ends). */
  exact: boolean;
  /** Optics in those cages by optic type: per device, and over the group. */
  optics: { opticId: string; perDevice: number; total: number }[];
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

/** Pools of a group in pool order: the ports one device uses, the device ports (cages) they sit in, their optics. */
function estimateGroup(lib: Library, v: VirtualTopo, g: VGroup): GroupEstimate {
  const hw = groupHardware(lib, g);
  const mapped = !!hw.device && g.portMap.length > 0;
  const use = portUse(g, v);
  const counted = new Set<string>();
  const pools = Object.entries(g.poolNames).map(([pool, names]): PoolEstimate => {
    const used = names.filter((p) => use.owner.has(p));
    const perOptic = new Map<string, number>();
    let cages = 0;
    for (const p of used) {
      const dp = hw.ports.get(p);
      if (!dp || counted.has(dp.cage)) continue;
      counted.add(dp.cage);
      cages++;
      if (dp.opticId && lib.optics.get(dp.opticId)) perOptic.set(dp.opticId, (perOptic.get(dp.opticId) ?? 0) + 1);
    }
    const speeds = poolSpeeds(g, hw, pool);
    return {
      pool, ports: used.length, ...(speeds.length === 1 ? { speedGbps: speeds[0] } : {}), ...(mapped ? { cages } : {}),
      exact: poolExact(v, g, pool, used.length),
      optics: [...perOptic].map(([opticId, n]) => ({ opticId, perDevice: n, total: n * g.count })),
    };
  });
  return { group: g, deviceId: hw.device?.id, pools };
}

/**
 * Estimated BOM of a virtual topology: each group's devices as its `device_type`, and the optic its `port_map` puts
 * in every cage its pools use. Lines merge by item type; the line's note is its derivation (`dt0 512 + t1 256`).
 * Cables, housings, racks and power need the physical layout and are not estimated.
 */
export function estimateTopoBom(lib: Library, v: VirtualTopo, s: TopoBomSettings): TopoBom {
  const groups = v.groups.map((g) => estimateGroup(lib, v, g));
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
  for (const { line, parts } of merged.values()) line.notes = [parts.join(' + ')];
  return { groups, lines, links: v.links.reduce((n, l) => n + (l.links ?? 0), 0) };
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
