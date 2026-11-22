import { keyVars, type VGroup, type VirtualTopo, type VLink } from './virtual';
import { allValues, drawnValues, pick, sliceTopo, withGaps, type Slice } from './slice';
import { portLayout, portUse } from './ports';

/** What the diagram shows. */
export interface DiagramOptions {
  /**
   * Partition keys a group box is split by, outer first (`plane>su`: one box per plane, inside it one per su), by
   * group name. '' = none; missing = the default (see shownNesting).
   */
  partition: Record<string, string>;
  /** Show each group's port grids. */
  ports: boolean;
}

export const DEFAULT_OPTIONS: DiagramOptions = { partition: {}, ports: true };

/** Layout metrics (SVG units). */
export const M = {
  pad: 24, gapX: 40, gapY: 120, head: 44, minW: 720, ruleRoom: 40,
  /** Height of one rule (two text lines and a gap). */
  ruleH: 40,
  dev: { w: 34, h: 20 }, gap: 6, ellipsis: 16, set: { head: 18, pad: 6, minW: 64 },
  /** Port grid: cell size, room for the summary and column numbers, room for lane letters. */
  grid: { cell: 7, head: 24, left: 12 },
} as const;

/** A drawn device: label, and the key values that place it (`index`: its number inside its innermost set). */
export interface DevBox { label: string; title: string; x: number; y: number; w: number; h: number; values: Record<string, string>; index?: number }
/** A drawn set (or the group body): nested sets or a row of devices, with ellipses for skipped values. */
export interface SetBox { label: string; x: number; y: number; w: number; h: number; sets: SetBox[]; devices: DevBox[]; ellipses: { x: number; y: number }[] }
export interface PortCell {
  port: string; col: number; row: number;
  /** Pool of this edge holding the port. */
  pool?: string;
  /** Pool on the opposite edge holding it; `otherUsed` when a link spec uses it there (drawn grey). */
  other?: string;
  otherUsed?: boolean;
  /** Link spec using the port. */
  link?: number;
}
/** Every port of one device on one edge of its group box (pools linking up on top, the rest at the bottom). */
export interface PortGrid {
  side: 'top' | 'bottom';
  cols: string[];
  rows: string[];
  cells: PortCell[];
  pools: { name: string; ports: number; used: number; slots: number }[];
  x: number; y: number; w: number; h: number;
}
export interface GroupBox {
  group: VGroup;
  tier: number;
  x: number; y: number; w: number; h: number;
  /** Partition keys the box is split by, outer first (empty = none). */
  nesting: string[];
  caption: string;
  grids: PortGrid[];
  body: SetBox;
}
/** A device-to-device line of a link spec. */
export interface LinkLine { link: number; from: [number, number]; to: [number, number] }
/** Where a link spec's rule text goes: right-aligned in the gap between its two tiers. */
export interface RuleAnchor { link: number; x: number; y: number }
export interface TopoDiagram { width: number; height: number; boxes: GroupBox[]; lines: LinkLine[]; rules: RuleAnchor[] }

const linkKey = (key?: string) => keyVars(key ?? '')[0];
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1));
const rowW = (xs: { w: number }[], gap: number) => xs.reduce((s, x) => s + x.w, 0) + Math.max(0, xs.length - 1) * gap;

/** Tier of each group: one above the highest group linking into it (from -> to). */
function tiers(v: VirtualTopo): Map<string, number> {
  const tier = new Map(v.groups.map((g) => [g.name, 0]));
  for (let i = 0; i < v.groups.length; i++) {
    let changed = false;
    for (const l of v.links) {
      if (l.from.group === l.to.group || !tier.has(l.from.group) || !tier.has(l.to.group)) continue;
      const want = tier.get(l.from.group)! + 1;
      if (tier.get(l.to.group)! < want) { tier.set(l.to.group, want); changed = true; }
    }
    if (!changed) break;
  }
  return tier;
}

/** Nestings a group can be drawn with: each key, each ordered pair of keys. */
export function nestingChoices(g: VGroup): string[] {
  const keys = g.partitions.map((p) => p.key);
  return [...keys, ...keys.flatMap((a) => keys.filter((b) => b !== a).map((b) => `${a}>${b}`))];
}

/**
 * The nesting shown for a group: the option when valid; else at most two keys, in this order: the key a mapped
 * link uses on the group (the planes that pair up), the key it is reached by from below, the key it reaches up with.
 */
export function shownNesting(g: VGroup, o: DiagramOptions, v: VirtualTopo): string {
  const p = o.partition[g.name];
  if (p !== undefined && (p === '' || nestingChoices(g).includes(p))) return p;
  const keys: string[] = [];
  const add = (key?: string) => { for (const k of keyVars(key ?? '')) if (g.partitions.some((q) => q.key === k) && !keys.includes(k)) keys.push(k); };
  const links = v.links.filter((l) => l.from.group !== l.to.group);
  for (const l of links) if (l.map.length) { if (l.from.group === g.name) add(l.from.key); if (l.to.group === g.name) add(l.to.key); }
  for (const l of links) if (l.to.group === g.name) add(l.to.key);
  for (const l of links) if (l.from.group === g.name) add(l.from.key);
  return keys.length ? keys.slice(0, 2).join('>') : g.partitions[0]?.key ?? '';
}

/** Devices in one set of `key` inside a set of `outerSize` devices (orthogonal unless declared `per` the outer key). */
function setSize(g: VGroup, key: string, value: string, outer: string | undefined, outerSize: number): number {
  const p = g.partitions.find((x) => x.key === key)!;
  if (!outer) return p.sizes ? p.sizes[value] ?? 0 : p.size;
  if (p.per?.includes(outer)) return p.size;
  const n = p.sizes ? Object.keys(p.sizes).length : p.count;
  return n ? outerSize / n : 0;
}

/** Places a row of items (devices or sets) and ellipses left to right, and sizes the box to it. */
function placeRow(box: SetBox, items: ({ w: number; h: number; x: number } | null)[]): void {
  let x = 0;
  const h = Math.max(M.dev.h, ...items.map((it) => it?.h ?? 0));
  for (const it of items) {
    if (!it) { box.ellipses.push({ x: x + M.ellipsis / 2, y: h / 2 + 4 }); x += M.ellipsis + M.gap; continue; }
    it.x = x; x += it.w + M.gap;
  }
  box.w = Math.max(0, x - M.gap); box.h = h;
}

/**
 * One level of a group box: a set per drawn value of `keys[0]`, each holding the next level. A level whose sets hold
 * one device draws them as devices labelled by the value; past the last key, the set's devices by their number.
 */
function buildLevel(g: VGroup, keys: string[], outer: string | undefined, size: number, values: Record<string, string>, slice: Slice): SetBox {
  const box: SetBox = { label: '', x: 0, y: 0, w: 0, h: 0, sets: [], devices: [], ellipses: [] };
  const dev = (label: string, title: string, vals: Record<string, string>, index?: number): DevBox =>
    ({ label, title, x: 0, y: 0, w: M.dev.w, h: M.dev.h, values: vals, index });
  const [key, ...rest] = keys;
  if (!key) {
    const n = Math.round(size);
    const all = Array.from({ length: n }, (_, i) => String(i + 1));
    const items = withGaps(pick(all), all).map((i) => (i === null ? null : dev(i, `device ${i} of ${n}`, values, Number(i))));
    box.devices = items.filter((x): x is DevBox => !!x);
    placeRow(box, items);
    return box;
  }
  const drawn = drawnValues(slice, g, key);
  const sizes = new Map(allValues(g, key).map((val) => [val, setSize(g, key, val, outer, size)]));
  if (!rest.length && [...sizes.values()].every((n) => Math.round(n) === 1)) {
    const items = drawn.map((val) => (val === null ? null : dev(val, `${key} ${val}`, { ...values, [key]: val })));
    box.devices = items.filter((x): x is DevBox => !!x);
    placeRow(box, items);
    return box;
  }
  const items = drawn.map((val) => {
    if (val === null) return null;
    const n = sizes.get(val) ?? 0;
    const inner = buildLevel(g, rest, key, n, { ...values, [key]: val }, slice);
    inner.x = M.set.pad; inner.y = M.set.head;
    return { label: `${key} ${val} · ${fmt(n)} dev`, x: 0, y: 0, w: Math.max(inner.w + 2 * M.set.pad, M.set.minW), h: M.set.head + inner.h + M.set.pad, sets: [inner], devices: [], ellipses: [] } as SetBox;
  });
  box.sets = items.filter((x): x is SetBox => !!x);
  placeRow(box, items);
  return box;
}

/** Every device box of a group, absolute. */
export function groupDevices(b: GroupBox): DevBox[] {
  const out: DevBox[] = [];
  const walk = (s: SetBox, ox: number, oy: number) => {
    const x = ox + s.x; const y = oy + s.y;
    for (const d of s.devices) out.push({ ...d, x: x + d.x, y: y + d.y });
    for (const c of s.sets) walk(c, x, y);
  };
  walk(b.body, b.x, b.y);
  return out;
}

/** Port grids of a group: pools facing up on top, the rest at the bottom; both the same layout. */
function portGrids(g: VGroup, v: VirtualTopo, facesUp: (pool: string) => boolean): PortGrid[] {
  if (!Object.keys(g.pools).length) return [];
  const layout = portLayout(g);
  const use = portUse(g, v);
  const grids: PortGrid[] = [];
  for (const side of ['top', 'bottom'] as const) {
    const names = Object.keys(g.pools).filter((n) => facesUp(n) === (side === 'top'));
    if (!names.length) continue;
    const mine = new Set(names);
    grids.push({
      side, cols: layout.cols, rows: layout.rows,
      cells: layout.cells.map((c) => {
        const pool = use.pool.get(c.port);
        if (pool && mine.has(pool)) return { ...c, pool, link: use.owner.get(c.port) };
        return { ...c, other: pool, otherUsed: use.owner.has(c.port) };
      }),
      pools: names.map((n) => ({ name: n, ports: g.pools[n], used: use.used.get(n) ?? 0, slots: g.poolSlots[n]?.length ?? 1 })),
      x: 0, y: 0, w: M.grid.left + layout.cols.length * M.grid.cell, h: M.grid.head + layout.rows.length * M.grid.cell,
    });
  }
  return grids;
}

/**
 * Tiered diagram of a virtual topology, drawn as a slice (see slice.ts): each group box is split by at most two
 * partition keys and shows its port grids; each link spec draws device-to-device lines between the drawn devices.
 */
export function layoutDiagram(v: VirtualTopo, o: DiagramOptions = DEFAULT_OPTIONS): TopoDiagram {
  const tier = tiers(v);
  const nesting = new Map(v.groups.map((g) => { const s = shownNesting(g, o, v); return [g.name, s ? s.split('>') : []]; }));
  // A pool faces up when it links to a higher tier (equal tiers: the from end).
  const up = new Set<string>();
  for (const l of v.links) {
    if (l.from.group === l.to.group) continue;
    const fromLow = (tier.get(l.to.group) ?? 0) >= (tier.get(l.from.group) ?? 0);
    up.add(fromLow ? `${l.from.group}\u0000${l.from.ports}` : `${l.to.group}\u0000${l.to.ports}`);
  }
  const slice = sliceTopo(v, nesting);
  const boxes: GroupBox[] = v.groups.map((group) => {
    const keys = nesting.get(group.name)!;
    const body = buildLevel(group, keys, undefined, group.count, {}, slice);
    const caption = keys.length
      ? keys.map((k) => { const p = group.partitions.find((x) => x.key === k)!; return p.sizes ? k : `${k} ${p.count} x ${p.size}`; }).join(' › ')
      : 'devices';
    const grids = o.ports ? portGrids(group, v, (pool) => up.has(`${group.name}\u0000${pool}`)) : [];
    const top = grids.find((q) => q.side === 'top'); const bottom = grids.find((q) => q.side === 'bottom');
    const w = Math.max(body.w + 24, group.name.length * 9 + 200, caption.length * 6.4 + 24, ...grids.map((q) => q.w + 24));
    body.y = M.head + (top ? top.h + 8 : 0);
    body.x = (w - body.w) / 2;
    if (top) { top.x = (w - top.w) / 2; top.y = M.head; }
    if (bottom) { bottom.x = (w - bottom.w) / 2; bottom.y = body.y + body.h + 8; }
    const h = body.y + body.h + 12 + (bottom ? bottom.h + 4 : 0);
    return { group, tier: tier.get(group.name) ?? 0, x: 0, y: 0, w, h, nesting: keys, caption, grids, body };
  });
  // Tiers top-down, each centred on the widest.
  const top = Math.max(0, ...boxes.map((b) => b.tier));
  const rows = Array.from({ length: top + 1 }, (_, i) => boxes.filter((b) => b.tier === top - i));
  const widest = Math.max(0, ...rows.map((t) => rowW(t, M.gapX)));
  const width = M.pad * 2 + Math.max(widest, M.minW) + M.ruleRoom;
  let y = M.pad;
  for (const t of rows) {
    let x = M.pad + (widest - rowW(t, M.gapX)) / 2;
    for (const b of t) { b.x = x; b.y = y; x += b.w + M.gapX; }
    y += Math.max(0, ...t.map((b) => b.h)) + M.gapY;
  }
  const at = new Map(boxes.map((b) => [b.group.name, b]));
  const devs = new Map(boxes.map((b) => [b.group.name, groupDevices(b)]));
  const lines: LinkLine[] = [];
  const rules: RuleAnchor[] = [];
  v.links.forEach((l, li) => {
    const a = at.get(l.from.group); const b = at.get(l.to.group);
    if (!a || !b || a === b) return;
    const aBelow = b.y < a.y;
    for (const [da, db] of devicePairs(l, devs.get(a.group.name)!, devs.get(b.group.name)!)) {
      lines.push({ link: li, from: [da.x + da.w / 2, aBelow ? da.y : da.y + da.h], to: [db.x + db.w / 2, aBelow ? db.y + db.h : db.y] });
    }
    const [lo, hi] = aBelow ? [a, b] : [b, a];
    rules.push({ link: li, x: width - M.pad, y: (hi.y + hi.h + lo.y) / 2 });
  });
  // Rules sharing a tier gap stack, centred on it.
  const byGap = new Map<number, RuleAnchor[]>();
  for (const r of rules) byGap.set(r.y, [...(byGap.get(r.y) ?? []), r]);
  for (const [y0, rs] of byGap) rs.forEach((r, i) => { r.y = y0 + (i - (rs.length - 1) / 2) * M.ruleH; });
  return { width, height: Math.max(M.pad * 2, y - M.gapY + M.pad), boxes, lines, rules };
}

/** Whether a device passes an end's filters: `key.index` by its number in its set, else by its key value. */
function passes(d: DevBox, filters: Record<string, string>): boolean {
  for (const [k, f] of Object.entries(filters)) {
    const val = k.endsWith('.index') ? (d.index === undefined ? undefined : String(d.index)) : d.values[k];
    if (val === undefined) continue;
    const ok = f.split(',').some((part) => {
      const r = /^(\d+)-(\d+)$/.exec(part.trim());
      return r ? Number(val) >= Number(r[1]) && Number(val) <= Number(r[2]) : part.trim() === val;
    });
    if (!ok) return false;
  }
  return true;
}

/**
 * Drawn device pairs of a link spec: a from device pairs with the drawn to devices whose key value it maps to
 * (`map`, else the same value; ends without a drawn key pair with all): all of them for mesh, the next in turn for
 * round-robin.
 */
function devicePairs(l: VLink, from: DevBox[], to: DevBox[]): [DevBox, DevBox][] {
  const ka = linkKey(l.from.key); const kb = linkKey(l.to.key);
  const peer = (val: string) => (l.map.length ? l.map.find((m) => m.from.includes(val))?.to : val);
  const tos = to.filter((d) => passes(d, l.to.filters));
  const out: [DevBox, DevBox][] = [];
  from.filter((d) => passes(d, l.from.filters)).forEach((x, i) => {
    const av = ka ? x.values[ka] : undefined;
    const pv = av === undefined ? undefined : peer(av);
    if (av !== undefined && pv === undefined) return;
    const ys = tos.filter((y) => { const bv = kb ? y.values[kb] : undefined; return pv === undefined || bv === undefined || bv === pv; });
    if (!ys.length) return;
    if (l.pattern === 'mesh') for (const y of ys) out.push([x, y]);
    else out.push([x, ys[i % ys.length]]);
  });
  return out;
}
