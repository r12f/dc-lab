import type { VGroup, VirtualTopo, VLink } from './virtual';

/** What each group box shows. */
export interface DiagramOptions {
  /**
   * Partition keys drawn as nested sets inside a group box, outer first (`su>plane`: one box per su, inside it one
   * box per plane), by group name. '' = none; missing = the key its upward link is keyed by, else its first key.
   */
  partition: Record<string, string>;
  /** Draw port pools on the box edges. */
  ports: boolean;
}

export const DEFAULT_OPTIONS: DiagramOptions = { partition: {}, ports: true };

/** Most set boxes drawn per level; the rest collapse into one "+N" box. */
export const MAX_SETS = 8;
/** Most outer sets drawn when sets are nested two levels. */
export const MAX_OUTER = 3;
/** Width of one drawn port cell in a pool strip. */
export const CELL_W = 4;
/** Most instance lines drawn per link spec; past it the spec draws one line between the group boxes. */
export const MAX_LINES = 256;
const PAD = 24;
const GAP_X = 56;
const GAP_Y = 150;
const HEAD = 30;
const LEAF_W = 64;
const LEAF_H = 54;
const DOT = 9;
const DOT_GAP = 3;
/** Device cells drawn per set: n <= 6 all, else 1-4, an ellipsis, n. */
const MAX_DOTS = 6;
const SET_GAP = 6;
const SUB_HEAD = 18;
const STRIP = 34;
const MAX_CELLS = 96;
const INNER = 12;

export interface SetBox {
  /** Partition values from the outermost level down: [["su","1"],["plane","3"]]. */
  path: [string, string][];
  label: string;
  sub: string;
  x: number; y: number; w: number; h: number;
  more?: boolean;
  children: SetBox[];
  /** Device cells (leaf sets): device number and x inside the box; null = ellipsis. */
  dots: { n: number | null; x: number }[];
}
export interface PoolBox {
  name: string;
  ports: number;
  /** Ports per slot (pools listed per peer slot), else one entry. */
  slots: number[];
  side: 'top' | 'bottom';
  x: number; y: number; w: number; h: number;
  /** Drawn port cells (capped); `ports` may be more. */
  cells: number;
}
export interface GroupBox {
  group: VGroup;
  level: number;
  x: number; y: number; w: number; h: number;
  /** Partition keys shown as nested sets, outer first (empty = none). */
  nesting: string[];
  caption?: string;
  sets: SetBox[];
  /** Partition lines when no sets are drawn, and where they start. */
  lines: string[];
  linesY: number;
  pools: PoolBox[];
}
/** One drawn line of a link spec: between two set boxes (or group boxes when no set level matches its key). */
/** `device`: a device-to-device line of the spec's sample pair, showing its pattern. */
export interface LinkPath { link: number; name: string; points: [number, number][]; self: boolean; device?: boolean }
export interface LinkLabel { link: number; name: string; x: number; y: number; lines: number }
export interface TopoDiagram { width: number; height: number; boxes: GroupBox[]; links: LinkPath[]; labels: LinkLabel[] }

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

const keyVarsOf = (key?: string) => (key ? [...key.matchAll(/\$\{([\w.]+)\}/g)].map((m) => m[1]) : []);

/** Nestings a group can be drawn with: each key, each ordered pair of keys. */
export function nestingChoices(g: VGroup): string[] {
  const keys = g.partitions.map((p) => p.key);
  const out = [...keys];
  for (const a of keys) for (const b of keys) if (a !== b) out.push(`${a}>${b}`);
  return out;
}

/** The nesting shown for a group under the options. */
export function shownNesting(g: VGroup, o: DiagramOptions, v?: VirtualTopo): string {
  const p = o.partition[g.name];
  if (p !== undefined && (p === '' || nestingChoices(g).includes(p))) return p;
  // Default: the keys its links are keyed by, so every link lands on the sets it pairs: the key it is reached by
  // from below (outer), then the key it reaches up with (inner); at most two levels.
  const used: string[] = [];
  const add = (key?: string) => { for (const k of keyVarsOf(key)) if (g.partitions.some((q) => q.key === k) && !used.includes(k)) used.push(k); };
  for (const l of v?.links ?? []) if (l.to.group === g.name && l.from.group !== g.name) add(l.to.key);
  for (const l of v?.links ?? []) if (l.from.group === g.name && l.to.group !== g.name) add(l.from.key);
  if (used.length) return used.slice(0, 2).join('>');
  return g.partitions[0]?.key ?? '';
}

/** Values of a partition key: named sets, else 1..count. With the size of one set. */
function values(g: VGroup, key: string, order: string[] = []): { value: string; size: number }[] {
  const p = g.partitions.find((x) => x.key === key);
  if (!p) return [];
  const all = p.sizes ? Object.entries(p.sizes).map(([value, size]) => ({ value, size }))
    : Array.from({ length: p.count }, (_, i) => ({ value: String(i + 1), size: p.size }));
  // Values a map groups together come first, side by side, so the drawn sets show the fan-in.
  const rank = new Map(order.map((v, i) => [v, i]));
  return [...all].sort((a, b) => (rank.get(a.value) ?? 1e9) - (rank.get(b.value) ?? 1e9));
}

/** Devices in one inner set: partitions are orthogonal unless the inner one is declared `per` the outer. */
function innerSize(g: VGroup, outer: string, inner: string, outerSize: number): number {
  const p = g.partitions.find((x) => x.key === inner)!;
  if (p.per?.includes(outer)) return p.size;
  const n = p.sizes ? Object.keys(p.sizes).length : p.count;
  return n ? outerSize / n : 0;
}

const poolW = (name: string, n: number, slots: number) => Math.max(name.length * 7 + 64, Math.min(n, MAX_CELLS) * CELL_W + slots * 2 + 16);
const rowW = (xs: { w: number }[], gap: number) => xs.reduce((s, x) => s + x.w, 0) + Math.max(0, xs.length - 1) * gap;
const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function capped<T>(xs: T[], more: (n: number) => T, max = MAX_SETS): T[] {
  return xs.length > max ? [...xs.slice(0, max - 1), more(xs.length - max + 1)] : xs;
}

/** Set boxes of a nesting, sized; positions relative to their parent. */
function buildSets(g: VGroup, nesting: string[], order: Record<string, string[]>): SetBox[] {
  const [outer, inner] = nesting;
  const leaf = (path: [string, string][], key: string, value: string, size: number): SetBox => {
    const n = Math.round(size);
    const ids: (number | null)[] = n <= MAX_DOTS ? Array.from({ length: n }, (_, i) => i + 1) : [1, 2, 3, 4, null, n];
    const w = Math.max(LEAF_W, ids.length * (DOT + DOT_GAP) + 12);
    const x0 = (w - (ids.length * (DOT + DOT_GAP) - DOT_GAP)) / 2;
    return { path, label: `${key} ${value}`, sub: `${fmtN(size)} dev`, x: 0, y: 0, w, h: LEAF_H, children: [], dots: ids.map((d, i) => ({ n: d, x: x0 + i * (DOT + DOT_GAP) })) };
  };
  const moreBox = (key: string, n: number): SetBox =>
    ({ path: [], label: `+${n}`, sub: `more ${key}`, x: 0, y: 0, w: LEAF_W, h: LEAF_H, more: true, children: [], dots: [] });
  return capped(values(g, outer, order[outer]).map(({ value, size }) => {
    if (!inner) return leaf([[outer, value]], outer, value, size);
    const kids = capped(values(g, inner, order[inner]).map((iv) => leaf([[outer, value], [inner, iv.value]], inner, iv.value, innerSize(g, outer, inner, size))),
      (n) => moreBox(inner, n));
    let x = SET_GAP;
    for (const k of kids) { k.x = x; k.y = SUB_HEAD; x += k.w + SET_GAP; }
    return { path: [[outer, value]], label: `${outer} ${value}`, sub: `${fmtN(size)} dev`, x: 0, y: 0, w: x, h: SUB_HEAD + LEAF_H + SET_GAP, children: kids, dots: [] } as SetBox;
  }), (n) => (inner ? { ...moreBox(outer, n), h: SUB_HEAD + LEAF_H + SET_GAP } : moreBox(outer, n)), inner ? MAX_OUTER : MAX_SETS);
}

/**
 * Tiered diagram of a virtual topology. A group box (header: name, role, count) holds its sets for the chosen
 * nesting of partitions, and, when ports are shown, its port pools as strips on the edges. Each link spec draws one
 * line per connected instance pair: from the set box of each from-instance (its key value) to the set box of the
 * to-instance it maps to (`map`, else the same value); an end whose key is not drawn as a set level uses its group
 * box. Lines run between bottom and top edges of the boxes.
 */
export function layoutDiagram(v: VirtualTopo, o: DiagramOptions = DEFAULT_OPTIONS): TopoDiagram {
  const level = levels(v);
  const up = new Set<string>();
  for (const l of v.links) {
    if (l.from.group === l.to.group) continue;
    const la = level.get(l.from.group) ?? 0; const lb = level.get(l.to.group) ?? 0;
    if (lb >= la) up.add(`${l.from.group}\u0000${l.from.ports}`); else up.add(`${l.to.group}\u0000${l.to.ports}`);
  }
  const boxes: GroupBox[] = v.groups.map((group) => {
    const shown = shownNesting(group, o, v);
    const nesting = shown ? shown.split('>') : [];
    // Map order for the keys this group is mapped from: ["1","5"],["2","6"] -> 1 5 2 6.
    const order: Record<string, string[]> = {};
    for (const l of v.links) if (l.from.group === group.name && l.map.length) for (const k of keyVarsOf(l.from.key)) order[k] ??= l.map.flatMap((m) => m.from);
    const sets = nesting.length ? buildSets(group, nesting, order) : [];
    const caption = nesting.length
      ? `by ${nesting.map((k) => { const p = group.partitions.find((x) => x.key === k)!; return p.sizes ? k : `${k} (${p.count} x ${p.size}${p.per?.length ? ` per ${p.per.join(', ')}` : ''})`; }).join(' › ')}`
      : undefined;
    const lines = nesting.length ? [] : group.partitions.map((x) => (x.sizes ? `${x.key}: ${Object.entries(x.sizes).map(([k, n]) => `${k}=${n}`).join(' ')}` : `${x.key}: ${x.count} x ${x.size}`));
    const pools: PoolBox[] = !o.ports ? [] : Object.entries(group.pools).map(([name, n]) => {
      const slots = group.poolSlots[name] ?? [n];
      return { name, ports: n, slots, side: up.has(`${group.name}\u0000${name}`) ? 'top' : 'bottom', x: 0, y: 0, w: poolW(name, n, slots.length), h: STRIP - 8, cells: Math.min(n, MAX_CELLS) };
    });
    const top = pools.filter((x) => x.side === 'top'); const bottom = pools.filter((x) => x.side === 'bottom');
    const w = Math.max(240, rowW(sets, SET_GAP * 2) + 2 * INNER, rowW(top, 8) + 2 * INNER, rowW(bottom, 8) + 2 * INNER, group.name.length * 9 + 160, (caption?.length ?? 0) * 6.6 + 2 * INNER);
    let y = HEAD + (top.length ? STRIP : 0);
    if (caption) y += 18;
    let x = (w - rowW(sets, SET_GAP * 2)) / 2;
    for (const s of sets) { s.x = x; s.y = y; x += s.w + SET_GAP * 2; }
    const linesY = y + 6;
    y += sets.length ? Math.max(...sets.map((s) => s.h)) + 10 : Math.max(1, lines.length) * 16 + 6;
    const h = y + (bottom.length ? STRIP : 4);
    const place = (xs: PoolBox[], py: number) => { let px = (w - rowW(xs, 8)) / 2; for (const q of xs) { q.x = px; q.y = py; px += q.w + 8; } };
    place(top, HEAD + 2);
    place(bottom, h - STRIP + 4);
    return { group, level: level.get(group.name) ?? 0, x: 0, y: 0, w, h, nesting, caption, sets, lines, linesY, pools };
  });
  const topLevel = Math.max(0, ...boxes.map((b) => b.level));
  const tiers = Array.from({ length: topLevel + 1 }, (_, i) => boxes.filter((b) => b.level === topLevel - i));
  const widest = Math.max(0, ...tiers.map((t) => rowW(t, GAP_X)));
  let y = PAD;
  for (const t of tiers) {
    let x = PAD + (widest - rowW(t, GAP_X)) / 2;
    for (const b of t) { b.x = x; b.y = y; x += b.w + GAP_X; }
    y += Math.max(0, ...t.map((b) => b.h)) + GAP_Y;
  }
  const at = new Map(boxes.map((b) => [b.group.name, b]));
  const links: LinkPath[] = [];
  const labels: LinkLabel[] = [];
  v.links.forEach((l, li) => {
    const a = at.get(l.from.group); const b = at.get(l.to.group);
    if (!a || !b) return;
    if (a === b) {
      const px = a.x + a.w; const py = a.y + a.h / 2;
      links.push({ link: li, name: l.name, self: true, points: [[px, py - 14], [px + 36, py - 14], [px + 36, py + 14], [px, py + 14]] });
      labels.push({ link: li, name: l.name, x: px + 42, y: py, lines: 1 });
      return;
    }
    const aUp = b.level >= a.level;
    const pairs = instancePairs(l, a, b);
    const fallback = pairs.length === 0 || pairs.length > MAX_LINES;
    const segs: [Rect, Rect][] = fallback ? [[whole(a), whole(b)]] : pairs;
    // Ends on one box fan out along its edge, in the order of the far ends.
    const fan = new Map<Rect, number[]>();
    segs.forEach(([ra, rb], i) => { (fan.get(ra) ?? fan.set(ra, []).get(ra)!).push(i); (fan.get(rb) ?? fan.set(rb, []).get(rb)!).push(i); });
    const far = (r: Rect, i: number) => { const [ra, rb] = segs[i]; const o2 = ra === r ? rb : ra; return o2.x + o2.w / 2; };
    for (const [r, idx] of fan) idx.sort((i, j) => far(r, i) - far(r, j));
    const pt = (r: Rect, i: number, top: boolean): [number, number] => {
      const idx = fan.get(r)!; const k = idx.indexOf(i); const n = idx.length;
      const span = Math.min(r.w - 10, n * 6);
      return [r.x + r.w / 2 + (n > 1 ? (k / (n - 1) - 0.5) * span : 0), top ? r.y : r.y + r.h];
    };
    // A shared horizontal run per spec, between the two tiers.
    const gapTop = Math.min(a.y + a.h, b.y + b.h); const gapBot = Math.max(a.y, b.y);
    const my = gapTop + (gapBot - gapTop) * (0.35 + 0.3 * ((li % 3) / 2));
    // The most vertical pair (shortest sideways run) is drawn device to device.
    let sample = -1; let best = Infinity;
    if (!fallback) segs.forEach(([ra, rb], i) => {
      if (!ra.dots?.length || !rb.dots?.length) return;
      const dx = Math.abs(ra.x + ra.w / 2 - (rb.x + rb.w / 2));
      if (dx < best) { best = dx; sample = i; }
    });
    segs.forEach(([ra, rb], i) => {
      if (i === sample) {
        const ya = aUp ? ra.y : ra.y + ra.h; const yb = aUp ? rb.y + rb.h : rb.y;
        for (const [da, db] of devicePairs(l, ra.dots!, rb.dots!)) links.push({ link: li, name: l.name, self: false, device: true, points: [[da, ya], [db, yb]] });
        return;
      }
      const [ax, ay] = pt(ra, i, aUp); const [bx, by] = pt(rb, i, !aUp);
      links.push({ link: li, name: l.name, self: false, points: [[ax, ay], [ax, my], [bx, my], [bx, by]] });
    });
    const xs = links.filter((p) => p.link === li && !p.device).flatMap((p) => [p.points[1][0], p.points[2][0]]);
    if (!xs.length) xs.push(...links.filter((p) => p.link === li).flatMap((p) => [p.points[0][0], p.points[1][0]]));
    labels.push({ link: li, name: l.name, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: my, lines: fallback ? 0 : segs.length });
  });
  return { width: PAD * 2 + widest + 160, height: Math.max(PAD * 2, y - GAP_Y + PAD), boxes, links, labels };
}

interface Rect { x: number; y: number; w: number; h: number; dots?: { n: number | null; x: number }[] }
const whole = (g: GroupBox): Rect => ({ x: g.x, y: g.y, w: g.w, h: g.h });

/** Absolute boxes of a group at the set level keyed by `key`, with their value for it. */
function boxesFor(g: GroupBox, key: string): { value: string; rect: Rect }[] {
  const out: { value: string; rect: Rect }[] = [];
  const walk = (s: SetBox, ox: number, oy: number) => {
    const r: Rect = { x: ox + s.x, y: oy + s.y, w: s.w, h: s.h, dots: s.dots.map((d) => ({ n: d.n, x: ox + s.x + d.x + DOT / 2 })) };
    const last = s.path[s.path.length - 1];
    if (!s.more && last && last[0] === key) out.push({ value: last[1], rect: r });
    for (const c of s.children) walk(c, r.x, r.y);
  };
  for (const s of g.sets) walk(s, g.x, g.y);
  return out;
}

/** Drawn instance pairs of a link spec: from set box -> to set box, by key value and map; filters restrict values. */
function instancePairs(l: VLink, a: GroupBox, b: GroupBox): [Rect, Rect][] {
  const ka = keyVarsOf(l.from.key).find((k) => a.nesting.includes(k));
  const kb = keyVarsOf(l.to.key).find((k) => b.nesting.includes(k));
  const keep = (e: VLink['from'], key: string | undefined, value: string) => !key || e.filters[key] === undefined || e.filters[key] === value;
  const fa = ka ? boxesFor(a, ka).filter((x) => keep(l.from, ka, x.value)) : [{ value: '', rect: whole(a) }];
  const fb = kb ? boxesFor(b, kb).filter((x) => keep(l.to, kb, x.value)) : [{ value: '', rect: whole(b) }];
  // Peer value of a from value: map, else the same value (keys on both ends), else every to box.
  const peer = (v: string): string | undefined => {
    if (l.map.length) return l.map.find((m) => m.from.includes(v))?.to;
    return v;
  };
  const out: [Rect, Rect][] = [];
  for (const x of fa) {
    if (!ka || !kb) { for (const y of fb) out.push([x.rect, y.rect]); continue; }
    const pv = peer(x.value);
    for (const y of fb) if (y.value === pv) out.push([x.rect, y.rect]);
  }
  return out;
}

/** Device lines of one instance pair between the drawn device cells: mesh = every cell to every cell, round-robin
 * = each from cell to the next to cell in turn. Ellipsis cells are skipped. */
function devicePairs(l: VLink, a: { n: number | null; x: number }[], b: { n: number | null; x: number }[]): [number, number][] {
  const fa = a.filter((d) => d.n !== null); const fb = b.filter((d) => d.n !== null);
  if (l.pattern === 'mesh') return fa.flatMap((x) => fb.map((y) => [x.x, y.x] as [number, number]));
  return fa.map((x, i) => [x.x, fb[i % fb.length].x]);
}
