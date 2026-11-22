import type { VGroup, VirtualTopo } from './virtual';

export const BOX_W = 280;
export const BOX_H = 108;
const GAP_X = 48;
const GAP_Y = 150;
const PAD = 24;

export interface GroupBox { group: VGroup; x: number; y: number; level: number }
export interface LinkPath {
  name: string;
  /** Polyline points, from end -> to end. */
  points: [number, number][];
  /** Label anchor. */
  lx: number;
  ly: number;
  self: boolean;
}
export interface TopoDiagram { width: number; height: number; boxes: GroupBox[]; links: LinkPath[] }

/**
 * Tiered diagram of a virtual topology: a group's tier is one above the highest group linking into it
 * (from -> to), so the lowest tier (e.g. servers) sits at the bottom. Groups of a tier sit side by side in
 * file order; links between the same two groups fan out side by side.
 */
export function layoutDiagram(v: VirtualTopo): TopoDiagram {
  const level = new Map(v.groups.map((g) => [g.name, 0]));
  // Longest path from the sources (bounded by the group count, so cycles cannot loop forever).
  for (let i = 0; i < v.groups.length; i++) {
    let changed = false;
    for (const l of v.links) {
      if (l.from.group === l.to.group || !level.has(l.from.group) || !level.has(l.to.group)) continue;
      const want = level.get(l.from.group)! + 1;
      if (level.get(l.to.group)! < want) { level.set(l.to.group, want); changed = true; }
    }
    if (!changed) break;
  }
  const top = Math.max(0, ...level.values());
  const rows = new Map<number, VGroup[]>();
  for (const g of v.groups) {
    const lv = level.get(g.name)!;
    rows.set(lv, [...(rows.get(lv) ?? []), g]);
  }
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const width = PAD * 2 + widest * BOX_W + (widest - 1) * GAP_X + 120;
  const boxes: GroupBox[] = [];
  for (const [lv, gs] of rows) {
    const rowW = gs.length * BOX_W + (gs.length - 1) * GAP_X;
    const x0 = PAD + (widest * BOX_W + (widest - 1) * GAP_X - rowW) / 2;
    gs.forEach((group, i) => boxes.push({ group, level: lv, x: x0 + i * (BOX_W + GAP_X), y: PAD + (top - lv) * (BOX_H + GAP_Y) }));
  }
  const at = new Map(boxes.map((b) => [b.group.name, b]));
  const pairCount = new Map<string, number>();
  const pairSeen = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join('\u0000');
  for (const l of v.links) pairCount.set(pairKey(l.from.group, l.to.group), (pairCount.get(pairKey(l.from.group, l.to.group)) ?? 0) + 1);
  const links: LinkPath[] = [];
  for (const l of v.links) {
    const a = at.get(l.from.group); const b = at.get(l.to.group);
    if (!a || !b) continue;
    const k = pairKey(l.from.group, l.to.group);
    const n = pairCount.get(k)!; const i = pairSeen.get(k) ?? 0;
    pairSeen.set(k, i + 1);
    const off = (i - (n - 1) / 2) * Math.min(56, (BOX_W - 40) / Math.max(1, n));
    if (a === b) {
      const x = a.x + BOX_W; const y = a.y + BOX_H / 2 + off / 2;
      links.push({ name: l.name, self: true, points: [[x, y - 14], [x + 40, y - 14], [x + 40, y + 14], [x, y + 14]], lx: x + 46, ly: y });
      continue;
    }
    const up = b.y < a.y;
    const ax = a.x + BOX_W / 2 + off; const bx = b.x + BOX_W / 2 + off;
    const ay = up ? a.y : a.y + BOX_H; const by = up ? b.y + BOX_H : b.y;
    const my = (ay + by) / 2;
    links.push({ name: l.name, self: false, points: [[ax, ay], [ax, my], [bx, my], [bx, by]], lx: (ax + bx) / 2, ly: my });
  }
  const bottom = Math.max(...boxes.map((b) => b.y + BOX_H), PAD);
  return { width, height: bottom + PAD, boxes, links };
}
