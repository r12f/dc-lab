import type { VGroup, VirtualTopo } from './virtual';

/** What each group box shows. */
export interface DiagramOptions {
  /** Partition key drawn as sets inside a group box, by group name ('' = none; missing = the group's first key). */
  partition: Record<string, string>;
  /** Draw port pools on the box edges. */
  ports: boolean;
}

export const DEFAULT_OPTIONS: DiagramOptions = { partition: {}, ports: true };

/** Most set boxes drawn per group; the rest collapse into one "+N" box. */
export const MAX_SETS = 8;
/** Width of one drawn port cell in a pool strip. */
export const CELL_W = 4;
const PAD = 24;
const GAP_X = 56;
const GAP_Y = 120;
const HEAD = 30;
const SET_W = 76;
const SET_H = 46;
const SET_GAP = 8;
const STRIP = 34;
const MAX_CELLS = 96;
const INNER = 12;

export interface SetBox { label: string; sub: string; x: number; y: number; w: number; h: number; more?: boolean }
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
  /** Partition shown as sets ('' = none). */
  partition: string;
  caption?: string;
  sets: SetBox[];
  /** Partition lines when no sets are drawn, and where they start. */
  lines: string[];
  linesY: number;
  pools: PoolBox[];
}
export interface LinkPath { name: string; points: [number, number][]; lx: number; ly: number; self: boolean }
export interface TopoDiagram { width: number; height: number; boxes: GroupBox[]; links: LinkPath[] }

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

/** The partition shown for a group under the options. */
export function shownPartition(g: VGroup, o: DiagramOptions): string {
  const p = o.partition[g.name];
  if (p !== undefined && (p === '' || g.partitions.some((x) => x.key === p))) return p;
  return g.partitions[0]?.key ?? '';
}

const poolW = (name: string, n: number, slots: number) => Math.max(name.length * 7 + 64, Math.min(n, MAX_CELLS) * CELL_W + slots * 2 + 16);
const rowW = (xs: { w: number }[], gap: number) => xs.reduce((s, x) => s + x.w, 0) + Math.max(0, xs.length - 1) * gap;

/**
 * Tiered diagram of a virtual topology. A group box (header: name, role, count) holds its sets for the chosen
 * partition (one box per set: `key value` + devices) and, when ports are shown, its port pools as strips on the
 * edges: a pool sits on the top edge when it links to a higher tier, else on the bottom edge; link lines end on
 * the pool they use.
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
    const partition = shownPartition(group, o);
    const p = group.partitions.find((x) => x.key === partition);
    const sets: SetBox[] = [];
    let caption: string | undefined;
    if (p) {
      const vals: [string, number][] = p.sizes ? Object.entries(p.sizes) : Array.from({ length: p.count }, (_, i) => [String(i + 1), p.size]);
      caption = p.sizes ? `by ${p.key}` : `by ${p.key}: ${p.count} x ${p.size}${p.per?.length ? ` per ${p.per.join(', ')}` : ''}`;
      const shown = vals.length > MAX_SETS ? vals.slice(0, MAX_SETS - 1) : vals;
      for (const [val, size] of shown) sets.push({ label: `${p.key} ${val}`, sub: `${size} dev`, x: 0, y: 0, w: SET_W, h: SET_H });
      if (vals.length > shown.length) sets.push({ label: `+${vals.length - shown.length}`, sub: 'more sets', x: 0, y: 0, w: SET_W, h: SET_H, more: true });
    }
    const lines = p ? [] : group.partitions.map((x) => (x.sizes ? `${x.key}: ${Object.entries(x.sizes).map(([k, n]) => `${k}=${n}`).join(' ')}` : `${x.key}: ${x.count} x ${x.size}`));
    const pools: PoolBox[] = !o.ports ? [] : Object.entries(group.pools).map(([name, n]) => {
      const slots = group.poolSlots[name] ?? [n];
      return { name, ports: n, slots, side: up.has(`${group.name}\u0000${name}`) ? 'top' : 'bottom', x: 0, y: 0, w: poolW(name, n, slots.length), h: STRIP - 8, cells: Math.min(n, MAX_CELLS) };
    });
    const top = pools.filter((x) => x.side === 'top'); const bottom = pools.filter((x) => x.side === 'bottom');
    const w = Math.max(240, rowW(sets, SET_GAP) + 2 * INNER, rowW(top, 8) + 2 * INNER, rowW(bottom, 8) + 2 * INNER, group.name.length * 9 + 160);
    let y = HEAD + (top.length ? STRIP : 0);
    if (caption) y += 18;
    let x = INNER;
    for (const s of sets) { s.x = x; s.y = y; x += s.w + SET_GAP; }
    const linesY = y + 6;
    y += sets.length ? SET_H + 10 : Math.max(1, lines.length) * 16 + 6;
    const h = y + (bottom.length ? STRIP : 4);
    const place = (xs: PoolBox[], py: number) => { let px = (w - rowW(xs, 8)) / 2; for (const q of xs) { q.x = px; q.y = py; px += q.w + 8; } };
    place(top, HEAD + 2);
    place(bottom, h - STRIP + 4);
    return { group, level: level.get(group.name) ?? 0, x: 0, y: 0, w, h, partition, caption, sets, lines, linesY, pools };
  });
  const topLevel = Math.max(0, ...boxes.map((b) => b.level));
  const tiers = Array.from({ length: topLevel + 1 }, (_, i) => boxes.filter((b) => b.level === topLevel - i));
  const tierW = (t: GroupBox[]) => rowW(t, GAP_X);
  const widest = Math.max(0, ...tiers.map(tierW));
  let y = PAD;
  for (const t of tiers) {
    let x = PAD + (widest - tierW(t)) / 2;
    for (const b of t) { b.x = x; b.y = y; x += b.w + GAP_X; }
    y += Math.max(0, ...t.map((b) => b.h)) + GAP_Y;
  }
  const at = new Map(boxes.map((b) => [b.group.name, b]));
  const ends = v.links.map((l) => {
    const a = at.get(l.from.group); const b = at.get(l.to.group);
    if (!a || !b) return undefined;
    const aUp = b.level >= a.level;
    return { l, a, b, aSide: (aUp ? 'top' : 'bottom') as 'top' | 'bottom', bSide: (aUp ? 'bottom' : 'top') as 'top' | 'bottom' };
  });
  // Link ends: on the pool strip used (else the box edge); specs sharing an end fan out along it.
  const endKey = (g: GroupBox, pool: string, side: string) => `${g.group.name}\u0000${o.ports ? pool : ''}\u0000${side}`;
  const used = new Map<string, number>();
  for (const e of ends) if (e && e.a !== e.b) for (const k of [endKey(e.a, e.l.from.ports, e.aSide), endKey(e.b, e.l.to.ports, e.bSide)]) used.set(k, (used.get(k) ?? 0) + 1);
  const seen = new Map<string, number>();
  const anchor = (g: GroupBox, pool: string, side: 'top' | 'bottom'): [number, number] => {
    const k = endKey(g, pool, side);
    const n = used.get(k) ?? 1; const i = seen.get(k) ?? 0; seen.set(k, i + 1);
    const pb = o.ports ? g.pools.find((q) => q.name === pool) : undefined;
    const cx = pb ? g.x + pb.x + pb.w / 2 : g.x + g.w / 2;
    const span = pb ? pb.w - 16 : g.w - 60;
    const off = n > 1 ? (i - (n - 1) / 2) * Math.min(28, span / n) : 0;
    // Into the strip itself, so a line visibly lands on its pool.
    return [cx + off, pb ? g.y + pb.y + (side === 'top' ? 0 : pb.h) : side === 'top' ? g.y : g.y + g.h];
  };
  const links: LinkPath[] = [];
  for (const e of ends) {
    if (!e) continue;
    const { l, a, b } = e;
    if (a === b) {
      const px = a.x + a.w; const py = a.y + a.h / 2;
      links.push({ name: l.name, self: true, points: [[px, py - 14], [px + 36, py - 14], [px + 36, py + 14], [px, py + 14]], lx: px + 42, ly: py });
      continue;
    }
    const [ax, ay] = anchor(a, l.from.ports, e.aSide);
    const [bx, by] = anchor(b, l.to.ports, e.bSide);
    const my = (ay + by) / 2;
    links.push({ name: l.name, self: false, points: [[ax, ay], [ax, my], [bx, my], [bx, by]], lx: (ax + bx) / 2, ly: my });
  }
  return { width: PAD * 2 + widest + 160, height: Math.max(PAD * 2, y - GAP_Y + PAD), boxes, links };
}
