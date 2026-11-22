import type { VGroup, VirtualTopo, VLink } from './virtual';

/** What each group box shows. */
export interface DiagramOptions {
  /**
   * Partition keys a group box is split by, outer first (`plane>su`: one box per plane, inside it one per su), by
   * group name. '' = none; missing = the default (see shownNesting).
   */
  partition: Record<string, string>;
  /** Show each group's port pools (name, ports, slots). */
  ports: boolean;
}

export const DEFAULT_OPTIONS: DiagramOptions = { partition: {}, ports: true };

/** Most values drawn per level (sets or devices): the first two, an ellipsis, the last. */
export const MAX_SHOWN = 3;
const PAD = 24;
const GAP_X = 40;
const GAP_Y = 120;
const HEAD = 44;
/** Port bitmap: one cell per port, wrapped. */
export const CELL = 4;
const CELLS_PER_ROW = 128;
const POOL_HEAD = 14;
const POOL_ROW_H = 8;
const DW = 34;
const DH = 20;
const GAP = 6;
const ELL = 16;
const SET_HEAD = 18;
const SET_PAD = 6;

export interface DevBox { label: string; title: string; x: number; y: number; w: number; h: number; vals: Record<string, string> }
export interface SetBox { label: string; sub: string; x: number; y: number; w: number; h: number; sets: SetBox[]; devices: DevBox[]; ellipses: { x: number; y: number }[] }
export interface GroupBox {
  group: VGroup;
  level: number;
  x: number; y: number; w: number; h: number;
  /** Partition keys the box is split by, outer first (empty = none). */
  nesting: string[];
  caption: string;
  /** Port pools with their bitmap (when Port pools is on), relative to the box. */
  pools: PoolBitmap[];
  body: SetBox;
}
/**
 * One pool of a group as a bitmap: the ports a device has in it, in pool order; the first `used` are taken (each
 * device fills its pool in order), split by link spec. Slots break the cells into runs.
 */
export interface PoolBitmap {
  name: string;
  ports: number;
  used: number;
  /** Ports per slot (one entry when the pool is not listed per slot). */
  slots: number[];
  /** Consecutive port runs taken by each link spec, in topo order. */
  runs: { link: number; name: string; start: number; count: number }[];
  x: number; y: number; w: number; h: number;
}
/** A device-to-device line of a link spec. */
export interface LinkPath { link: number; name: string; points: [number, number][] }
/** Rule text of a link spec, right-aligned in the gap between its two tiers. */
export interface LinkLabel { link: number; name: string; x: number; y: number }
export interface TopoDiagram { width: number; height: number; boxes: GroupBox[]; links: LinkPath[]; labels: LinkLabel[] }

const keyVarsOf = (key?: string) => (key ? [...key.matchAll(/\$\{([\w.]+)\}/g)].map((m) => m[1]) : []);

/** Tier of each group: one above the highest group linking into it (from -> to). */
function levels(v: VirtualTopo): Map<string, number> {
  const level = new Map(v.groups.map((g) => [g.name, 0]));
  for (let i = 0; i < v.groups.length; i++) {
    let changed = false;
    for (const l of v.links) {
      if (l.from.group === l.to.group || !level.has(l.from.group) || !level.has(l.to.group)) continue;
      const want = level.get(l.from.group)! + 1;
      if (level.get(l.to.group)! < want) { level.set(l.to.group, want); changed = true; }
    }
    if (!changed) break;
  }
  return level;
}

/** Nestings a group can be drawn with: each key, each ordered pair of keys. */
export function nestingChoices(g: VGroup): string[] {
  const keys = g.partitions.map((p) => p.key);
  const out = [...keys];
  for (const a of keys) for (const b of keys) if (a !== b) out.push(`${a}>${b}`);
  return out;
}

/**
 * The nesting shown for a group. Default, at most two keys: the key a mapped link uses on this group (the planes
 * that pair up), then the key it is reached by from below, then the key it reaches up with.
 */
export function shownNesting(g: VGroup, o: DiagramOptions, v?: VirtualTopo): string {
  const p = o.partition[g.name];
  if (p !== undefined && (p === '' || nestingChoices(g).includes(p))) return p;
  const keys: string[] = [];
  const add = (key?: string) => { for (const k of keyVarsOf(key)) if (g.partitions.some((q) => q.key === k) && !keys.includes(k)) keys.push(k); };
  const links = (v?.links ?? []).filter((l) => l.from.group !== l.to.group);
  for (const l of links) if (l.map.length) { if (l.from.group === g.name) add(l.from.key); if (l.to.group === g.name) add(l.to.key); }
  for (const l of links) if (l.to.group === g.name) add(l.to.key);
  for (const l of links) if (l.from.group === g.name) add(l.from.key);
  if (keys.length) return keys.slice(0, 2).join('>');
  return g.partitions[0]?.key ?? '';
}

/** All values of a partition key: named sets, else 1..count. */
function allValues(g: VGroup, key: string): string[] {
  const p = g.partitions.find((x) => x.key === key);
  if (!p) return [];
  return p.sizes ? Object.keys(p.sizes) : Array.from({ length: p.count }, (_, i) => String(i + 1));
}

/** Devices in one set of `key` inside a set of `outerSize` devices (orthogonal unless declared `per`). */
function setSize(g: VGroup, key: string, value: string, outer: string | undefined, outerSize: number): number {
  const p = g.partitions.find((x) => x.key === key)!;
  if (!outer) return p.sizes ? p.sizes[value] ?? 0 : p.size;
  if (p.per?.includes(outer)) return p.size;
  const n = p.sizes ? Object.keys(p.sizes).length : p.count;
  return n ? outerSize / n : 0;
}

/** Picked values with an ellipsis wherever values of `all` are skipped; else capped. */
function gapped(values: string[], all?: string[]): (string | null)[] {
  if (!all) return capped(values);
  const at = new Map(all.map((x, i) => [x, i]));
  const out: (string | null)[] = [];
  values.forEach((x, i) => { if (i && (at.get(x) ?? 0) !== (at.get(values[i - 1]) ?? 0) + 1) out.push(null); out.push(x); });
  if (values.length && (at.get(values[values.length - 1]) ?? 0) < all.length - 1) out.push(null);
  return out;
}

/** First two and last. */
const pick3 = <T>(xs: T[]): T[] => (xs.length > MAX_SHOWN ? [...xs.slice(0, MAX_SHOWN - 1), xs[xs.length - 1]] : xs);

/** Order a group's key values are walked in when drawn (a map's order), by `group\u0000key`. */
const orderOf = new Map<string, string[]>();

/** First two, null (ellipsis), last. */
function capped<T>(xs: T[]): (T | null)[] {
  return xs.length > MAX_SHOWN ? [...xs.slice(0, MAX_SHOWN - 1), null, xs[xs.length - 1]] : xs;
}

/**
 * Values drawn per group and key, so every drawn link has both ends drawn: a mapped link shows the first to value
 * and the from values that map onto it; a keyed link without a map copies one side's values to the other.
 */
function focus(v: VirtualTopo, nest: Map<string, string[]>): Map<string, Map<string, string[]>> {
  const shown = new Map(v.groups.map((g) => [g.name, new Map<string, string[]>()]));
  const drawn = (g: string, k: string) => nest.get(g)?.includes(k);
  for (const l of v.links) {
    if (!l.map.length) continue;
    const [ka] = keyVarsOf(l.from.key); const [kb] = keyVarsOf(l.to.key);
    if (!ka || !kb || !drawn(l.to.group, kb)) continue;
    // To values: first, second, last target of the map; from values: per drawn target, first, second and last of
    // the values mapping onto it, in map order (so the ellipses fall between and inside the map groups).
    const to = shown.get(l.to.group)!;
    const targets = [...new Set(l.map.map((m) => m.to))];
    if (!to.has(kb)) to.set(kb, pick3(targets));
    const tv = to.get(kb)!;
    const from = shown.get(l.from.group)!;
    if (!from.has(ka)) {
      from.set(ka, tv.flatMap((t) => pick3(l.map.filter((m) => m.to === t).flatMap((m) => m.from))));
      orderOf.set(`${l.from.group}\u0000${ka}`, l.map.flatMap((m) => m.from));
      orderOf.set(`${l.to.group}\u0000${kb}`, targets);
    }
  }
  for (let i = 0; i < v.links.length; i++) for (const l of v.links) {
    if (l.map.length || l.from.group === l.to.group) continue;
    const [ka] = keyVarsOf(l.from.key); const [kb] = keyVarsOf(l.to.key);
    if (!ka || !kb) continue;
    const a = shown.get(l.from.group)!; const b = shown.get(l.to.group)!;
    if (a.has(ka) && !b.has(kb) && drawn(l.to.group, kb)) b.set(kb, a.get(ka)!);
    else if (b.has(kb) && !a.has(ka) && drawn(l.from.group, ka)) a.set(ka, b.get(kb)!);
    else if (!a.has(ka) && !b.has(kb) && drawn(l.from.group, ka) && drawn(l.to.group, kb)) {
      // Same key on both ends, neither fixed yet: show the same values on both (first, second, last common).
      const ga = v.groups.find((g) => g.name === l.from.group)!; const gb = v.groups.find((g) => g.name === l.to.group)!;
      const inB = new Set(allValues(gb, kb));
      const common = allValues(ga, ka).filter((x) => inB.has(x));
      a.set(ka, pick3(common)); b.set(kb, pick3(common));
    }
  }
  return shown;
}

/**
 * Builds one level of a group box: sets of `keys[0]` (capped), each holding the next level; a level whose sets hold
 * one device draws them as devices labelled by the value; the last level draws its devices (capped) by index.
 */
function buildLevel(g: VGroup, keys: string[], outer: string | undefined, size: number, vals: Record<string, string>,
  shown: Map<string, string[]>): SetBox {
  const box: SetBox = { label: '', sub: '', x: 0, y: 0, w: 0, h: 0, sets: [], devices: [], ellipses: [] };
  const [key, ...rest] = keys;
  const devRow = (items: ({ label: string; title: string; vals: Record<string, string> } | null)[]) => {
    let x = 0;
    for (const it of items) {
      if (!it) { box.ellipses.push({ x: x + ELL / 2, y: DH / 2 + 4 }); x += ELL + GAP; continue; }
      box.devices.push({ ...it, x, y: 0, w: DW, h: DH });
      x += DW + GAP;
    }
    box.w = Math.max(0, x - GAP); box.h = DH;
  };
  if (!key) {
    const n = Math.round(size);
    devRow(capped(Array.from({ length: n }, (_, i) => i + 1)).map((i) => (i === null ? null : { label: String(i), title: `device ${i} of ${n}`, vals: { ...vals, '#': String(i) } })));
    return box;
  }
  const all = orderOf.get(`${g.name}\u0000${key}`) ?? allValues(g, key);
  const picked = shown.get(key);
  const values = picked ?? all;
  const sizes = new Map(values.map((val) => [val, setSize(g, key, val, outer, size)]));
  if (!rest.length && values.every((val) => Math.round(sizes.get(val)!) === 1)) {
    devRow(gapped(values, picked ? all : undefined).map((val) => (val === null ? null : { label: val, title: `${key} ${val}`, vals: { ...vals, [key]: val } })));
    return box;
  }
  let x = 0; let h = 0;
  for (const val of gapped(values, picked ? all : undefined)) {
    if (val === null) { box.ellipses.push({ x: x + ELL / 2, y: 0 }); x += ELL + GAP; continue; }
    const n = sizes.get(val)!;
    const inner = buildLevel(g, rest, key, n, { ...vals, [key]: val }, shown);
    const s: SetBox = { label: `${key} ${val}`, sub: `${fmtN(n)} dev`, x, y: 0, w: Math.max(inner.w + 2 * SET_PAD, 64), h: SET_HEAD + inner.h + SET_PAD, sets: [inner], devices: [], ellipses: [] };
    inner.x = SET_PAD; inner.y = SET_HEAD;
    box.sets.push(s);
    x += s.w + GAP; h = Math.max(h, s.h);
  }
  for (const e of box.ellipses) e.y = h / 2 + 4;
  box.w = Math.max(0, x - GAP); box.h = h;
  return box;
}

const fmtN = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1));
const rowW = (xs: { w: number }[], gap: number) => xs.reduce((s, x) => s + x.w, 0) + Math.max(0, xs.length - 1) * gap;

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

/**
 * Tiered diagram of a virtual topology, drawn as a slice: each group box is split by its partitions (at most two
 * levels), each level shows at most three values (first, second, ..., last) and each set at most three devices,
 * labelled by index or value. Each link spec draws its device-to-device lines between the drawn devices: a from
 * device pairs with the to devices whose key value it maps to (`map`, else the same value), all of them for mesh,
 * the next in turn for round-robin.
 */
export function layoutDiagram(v: VirtualTopo, o: DiagramOptions = DEFAULT_OPTIONS): TopoDiagram {
  const level = levels(v);
  const nest = new Map(v.groups.map((g) => { const s = shownNesting(g, o, v); return [g.name, s ? s.split('>') : []]; }));
  orderOf.clear();
  const shown = focus(v, nest);
  const boxes: GroupBox[] = v.groups.map((group) => {
    const nesting = nest.get(group.name)!;
    const body = buildLevel(group, nesting, undefined, group.count, {}, shown.get(group.name)!);
    const caption = nesting.length
      ? nesting.map((k) => { const p = group.partitions.find((x) => x.key === k)!; return p.sizes ? k : `${k} ${p.count} x ${p.size}`; }).join(' › ')
      : 'devices';
    const pools: PoolBitmap[] = [];
    let py = HEAD;
    if (o.ports) for (const [name, ports] of Object.entries(group.pools)) {
      const runs: PoolBitmap['runs'] = [];
      let at = 0;
      v.links.forEach((l, li) => {
        for (const [e, n] of [[l.from, l.fromPorts], [l.to, l.toPorts]] as const) {
          if (e.group !== group.name || e.ports !== name || n === undefined) continue;
          const count = Math.min(Math.round(n), ports - at);
          if (count > 0) { runs.push({ link: li, name: l.name, start: at, count }); at += count; }
        }
      });
      const rows = Math.max(1, Math.ceil(ports / CELLS_PER_ROW));
      const w = Math.min(ports, CELLS_PER_ROW) * CELL + 2 * (group.poolSlots[name]?.length ?? 1);
      pools.push({ name, ports, used: at, slots: group.poolSlots[name] ?? [ports], runs, x: 12, y: py, w, h: POOL_HEAD + rows * POOL_ROW_H });
      py += POOL_HEAD + rows * POOL_ROW_H + 6;
    }
    const top = py + (pools.length ? 4 : 0);
    body.x = 12; body.y = top;
    const w = Math.max(body.w + 24, group.name.length * 9 + 200, caption.length * 6.4 + 24, ...pools.map((q) => q.w + 24));
    return { group, level: level.get(group.name) ?? 0, x: 0, y: 0, w, h: top + body.h + 12, nesting, caption, pools, body };
  });
  const topLevel = Math.max(0, ...boxes.map((b) => b.level));
  const tiers = Array.from({ length: topLevel + 1 }, (_, i) => boxes.filter((b) => b.level === topLevel - i));
  const widest = Math.max(0, ...tiers.map((t) => rowW(t, GAP_X)));
  const width = PAD * 2 + Math.max(widest, 720) + 40;
  let y = PAD;
  for (const t of tiers) {
    let x = PAD + (widest - rowW(t, GAP_X)) / 2;
    for (const b of t) { b.x = x; b.y = y; x += b.w + GAP_X; }
    y += Math.max(0, ...t.map((b) => b.h)) + GAP_Y;
  }
  const at = new Map(boxes.map((b) => [b.group.name, b]));
  const devs = new Map(boxes.map((b) => [b.group.name, groupDevices(b)]));
  const links: LinkPath[] = [];
  const labels: LinkLabel[] = [];
  v.links.forEach((l, li) => {
    const a = at.get(l.from.group); const b = at.get(l.to.group);
    if (!a || !b || a === b) return;
    const aUp = b.y < a.y;
    for (const [da, db] of devicePairs(l, devs.get(a.group.name)!, devs.get(b.group.name)!)) {
      const ya = aUp ? da.y : da.y + da.h; const yb = aUp ? db.y + db.h : db.y;
      links.push({ link: li, name: l.name, points: [[da.x + da.w / 2, ya], [db.x + db.w / 2, yb]] });
    }
    const lo = aUp ? a : b; const hi = aUp ? b : a;
    labels.push({ link: li, name: l.name, x: width - PAD, y: (hi.y + hi.h + lo.y) / 2 });
  });
  return { width, height: Math.max(PAD * 2, y - GAP_Y + PAD), boxes, links, labels };
}

/** Whether a device passes an end's filters (values it has; `key.index` and plain ranges). */
function passes(d: DevBox, filters: Record<string, string>): boolean {
  for (const [k, f] of Object.entries(filters)) {
    // `key.index`: the device's number inside its set of that key; else the key's value.
    const val = k.endsWith('.index') ? d.vals['#'] : d.vals[k];
    if (val === undefined) continue;
    const ok = f.split(',').some((part) => {
      const r = /^(\d+)-(\d+)$/.exec(part.trim());
      return r ? Number(val) >= Number(r[1]) && Number(val) <= Number(r[2]) : part.trim() === val;
    });
    if (!ok) return false;
  }
  return true;
}

/** Drawn device pairs of a link spec. */
function devicePairs(l: VLink, from: DevBox[], to: DevBox[]): [DevBox, DevBox][] {
  const [ka] = keyVarsOf(l.from.key); const [kb] = keyVarsOf(l.to.key);
  const peer = (val: string) => (l.map.length ? l.map.find((m) => m.from.includes(val))?.to : val);
  const fa = from.filter((d) => passes(d, l.from.filters));
  const fb = to.filter((d) => passes(d, l.to.filters));
  const out: [DevBox, DevBox][] = [];
  fa.forEach((x, i) => {
    const av = ka ? x.vals[ka] : undefined;
    const pv = av === undefined ? undefined : peer(av);
    if (av !== undefined && pv === undefined) return;
    const ys = fb.filter((y) => { const bv = kb ? y.vals[kb] : undefined; return pv === undefined || bv === undefined || bv === pv; });
    if (!ys.length) return;
    if (l.pattern === 'mesh') for (const y of ys) out.push([x, y]);
    else out.push([x, ys[i % ys.length]]);
  });
  return out;
}
