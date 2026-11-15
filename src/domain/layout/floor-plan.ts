import type { CableTray, DcLayout, Rect, Row } from './types';

export type BandKind = 'row' | 'aisle';

export interface Band {
  kind: BandKind;
  id: string;
  rect: Rect;
  /** Row block (0 = northmost); a cross aisle belongs to the block north of it. */
  block: number;
  /** Cross aisle: runs east–west across the rack area between two row blocks. */
  cross?: boolean;
}

export interface FloorPlan {
  bands: Band[];
  /** Rect of every row and aisle by id. */
  rects: Map<string, Rect>;
  /** Widest row block (mm). */
  usedWidthMm: number;
  /** Row blocks and cross aisles, north to south (mm). */
  usedDepthMm: number;
  /** North edge and depth of every row block (cross aisles excluded), north to south. */
  blocks: { y: number; depthMm: number }[];
}

/** Room left south of a cross aisle for the next block's row headers (drawn above each row, as north of the first block). */
export const ROW_HEADER_MM = 1040;

const rowWidth = (r: Row) => r.tileDepthMm;
const rowLength = (r: Row) => r.tileCount * r.tileWidthMm;

/**
 * Packs the sequence into the rack area. Cross aisles split it into **row blocks** stacked north to south: inside a
 * block, rows and aisles pack edge to edge from the west edge; a block is as deep as its longest row (the last block
 * reaches down to the rack area's south edge) and its aisles span that depth. A cross aisle spans the rack area's
 * width, `widthMm` north–south, between two blocks; the next block starts `ROW_HEADER_MM` south of it (its headers).
 */
export function computeFloorPlan(l: DcLayout): FloorPlan {
  const ws = l.whitespace;
  const rows = new Map(l.rows.map((r) => [r.id, r]));
  const aisles = new Map(l.aisles.map((a) => [a.id, a]));
  const segments: string[][] = [[]];
  const crosses: string[] = [];
  for (const id of l.sequence) {
    if (aisles.get(id)?.cross) { crosses.push(id); segments.push([]); continue; }
    if (rows.has(id) || aisles.has(id)) segments[segments.length - 1].push(id);
  }
  const bands: Band[] = [];
  const blocks: FloorPlan['blocks'] = [];
  let y = ws.y;
  let usedWidthMm = 0;
  segments.forEach((seg, i) => {
    const longest = Math.max(0, ...seg.map((id) => { const r = rows.get(id); return r ? rowLength(r) : 0; }));
    const last = i === segments.length - 1;
    const depth = last ? Math.max(ws.y + ws.depthMm - y, longest) : longest;
    let x = ws.x;
    for (const id of seg) {
      const row = rows.get(id);
      const w = row ? rowWidth(row) : aisles.get(id)!.widthMm;
      bands.push({ kind: row ? 'row' : 'aisle', id, block: i, rect: { x, y, widthMm: w, depthMm: row ? rowLength(row) : depth } });
      x += w;
    }
    usedWidthMm = Math.max(usedWidthMm, x - ws.x);
    blocks.push({ y, depthMm: depth });
    y += depth;
    if (!last) {
      const c = aisles.get(crosses[i])!;
      bands.push({ kind: 'aisle', id: c.id, block: i, cross: true, rect: { x: ws.x, y, widthMm: ws.widthMm, depthMm: c.widthMm } });
      y += c.widthMm + ROW_HEADER_MM;
    }
  });
  return { bands, rects: new Map(bands.map((b) => [b.id, b.rect])), usedWidthMm, usedDepthMm: y - ws.y, blocks };
}

/**
 * A tray's rect. Aisle tray: along its aisle / cross aisle, full length, centred and shifted `offsetMm` across.
 * Floating tray: east–west across the rows from `fromId` to `toId` (both bands included), `widthMm` deep at `y`.
 * Undefined if a band it needs is gone.
 */
export function trayRect(plan: FloorPlan, tray: CableTray): Rect | undefined {
  if (tray.floating) {
    const a = tray.fromId ? plan.rects.get(tray.fromId) : undefined;
    const b = tray.toId ? plan.rects.get(tray.toId) : undefined;
    if (!a || !b || tray.y === undefined) return undefined;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x + a.widthMm, b.x + b.widthMm);
    return { x: x0, y: tray.y, widthMm: x1 - x0, depthMm: tray.widthMm };
  }
  const b = tray.overId ? plan.rects.get(tray.overId) : undefined;
  if (!b) return undefined;
  const off = tray.offsetMm ?? 0;
  if (b.widthMm > b.depthMm) {
    return { x: b.x, y: b.y + (b.depthMm - tray.widthMm) / 2 + off, widthMm: b.widthMm, depthMm: tray.widthMm };
  }
  return { x: b.x + (b.widthMm - tray.widthMm) / 2 + off, y: b.y, widthMm: tray.widthMm, depthMm: b.depthMm };
}

/** Rectangle of `count` tiles of a row (at `rowRect`) starting at `tile` (0 = north end). */
export function tileRect(rowRect: Rect, row: Row, tile: number, count = 1): Rect {
  return { x: rowRect.x, y: rowRect.y + tile * row.tileWidthMm, widthMm: rowRect.widthMm, depthMm: count * row.tileWidthMm };
}

/**
 * Moves row / aisle `id` to the slot nearest (`centerX`, `centerY`): the row block under `centerY` (default: its
 * own block), then by centre x inside that block. Cross aisles are not dragged.
 */
export function reorderTo(l: DcLayout, id: string, centerX: number, centerY?: number): string[] {
  if (l.aisles.find((a) => a.id === id)?.cross) return l.sequence;
  const own = computeFloorPlan(l).bands.find((b) => b.id === id)?.block ?? 0;
  const others = l.sequence.filter((x) => x !== id);
  const plan = computeFloorPlan({ ...l, sequence: others });
  let block = own;
  if (centerY !== undefined) {
    block = plan.blocks.findIndex((b) => centerY < b.y + b.depthMm);
    if (block < 0) block = plan.blocks.length - 1;
  }
  block = Math.max(0, Math.min(block, plan.blocks.length - 1));
  const before = plan.bands.filter((b) => b.block === block && !b.cross && b.rect.x + b.rect.widthMm / 2 < centerX);
  // After the last band west of the point, else at the start of the block (right after the cross aisle above it).
  let index: number;
  if (before.length) index = others.indexOf(before[before.length - 1].id) + 1;
  else if (block === 0) index = 0;
  else index = others.indexOf(plan.bands.find((b) => b.cross && b.block === block - 1)!.id) + 1;
  return [...others.slice(0, index), id, ...others.slice(index)];
}

const distance = (r: Rect, x: number, y: number) =>
  Math.hypot(Math.max(r.x - x, 0, x - r.x - r.widthMm), Math.max(r.y - y, 0, y - r.y - r.depthMm));

/** The aisle or cross aisle nearest the point, for dropping an aisle tray; inside one = that one. */
export function nearestBand(plan: FloorPlan, x: number, y: number): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const b of plan.bands) {
    if (b.kind !== 'aisle') continue;
    const d = distance(b.rect, x, y);
    if (!best || d < best.d) best = { id: b.id, d };
  }
  return best?.id;
}

/** The (lengthwise) aisle whose band is nearest `x` (mm). */
export function nearestAisle(plan: FloorPlan, x: number): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const b of plan.bands) {
    if (b.kind !== 'aisle' || b.cross) continue;
    const d = Math.abs(b.rect.x + b.rect.widthMm / 2 - x);
    if (!best || d < best.d) best = { id: b.id, d };
  }
  return best?.id;
}

/** Rows in sequence order (block by block, west to east): the order racks step through when moved. */
export function rowOrder(l: DcLayout): Row[] {
  return l.sequence.map((id) => l.rows.find((r) => r.id === id)).filter((r): r is Row => !!r);
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.widthMm && b.x < a.x + a.widthMm && a.y < b.y + b.depthMm && b.y < a.y + a.depthMm;

/** Arrangement problems: overflowing the rack area, facilities intruding into it, trays over nothing. */
export function floorWarnings(l: DcLayout): string[] {
  const plan = computeFloorPlan(l);
  const ws = l.whitespace;
  const out: string[] = [];
  if (plan.usedWidthMm > ws.widthMm) out.push(`Rows and aisles need ${plan.usedWidthMm} mm; rack area is ${ws.widthMm} mm wide`);
  if (plan.blocks.length > 1) {
    if (plan.usedDepthMm > ws.depthMm) out.push(`Row blocks and cross aisles need ${plan.usedDepthMm} mm; rack area is ${ws.depthMm} mm deep`);
  } else {
    for (const r of l.rows) if (rowLength(r) > ws.depthMm) out.push(`${r.name} is ${rowLength(r)} mm long; rack area is ${ws.depthMm} mm deep`);
  }
  for (const f of l.facilities) if (overlaps(f, ws)) out.push(`${f.name} overlaps the rack area`);
  for (const t of l.trays) if (!trayRect(plan, t)) out.push(`Tray ${t.id} runs over nothing`);
  return out;
}
