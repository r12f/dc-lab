import type { CableTray, DcLayout, Rect, Row } from './types';

export type BandKind = 'row' | 'aisle';

export interface Band {
  kind: BandKind;
  id: string;
  rect: Rect;
}

export interface FloorPlan {
  bands: Band[];
  /** Rect of every row and aisle by id. */
  rects: Map<string, Rect>;
  /** Total width of the sequence (mm). */
  usedWidthMm: number;
}

const rowWidth = (r: Row) => r.tileDepthMm;
const rowLength = (r: Row) => r.tileCount * r.tileWidthMm;

/** Packs rows and aisles edge to edge from the rack area's west edge, in sequence order. */
export function computeFloorPlan(l: DcLayout): FloorPlan {
  const ws = l.whitespace;
  const rows = new Map(l.rows.map((r) => [r.id, r]));
  const aisles = new Map(l.aisles.map((a) => [a.id, a]));
  const bands: Band[] = [];
  let x = ws.x;
  for (const id of l.sequence) {
    const row = rows.get(id);
    const aisle = aisles.get(id);
    if (row) bands.push({ kind: 'row', id, rect: { x, y: ws.y, widthMm: rowWidth(row), depthMm: rowLength(row) } });
    else if (aisle) bands.push({ kind: 'aisle', id, rect: { x, y: ws.y, widthMm: aisle.widthMm, depthMm: ws.depthMm } });
    else continue;
    x += bands[bands.length - 1].rect.widthMm;
  }
  return { bands, rects: new Map(bands.map((b) => [b.id, b.rect])), usedWidthMm: x - ws.x };
}

/** A tray's rect: centred on its aisle, full aisle length; undefined if the aisle is gone. */
export function trayRect(plan: FloorPlan, tray: CableTray): Rect | undefined {
  const a = plan.rects.get(tray.aisleId);
  if (!a) return undefined;
  return { x: a.x + (a.widthMm - tray.widthMm) / 2, y: a.y, widthMm: tray.widthMm, depthMm: a.depthMm };
}

/** Rectangle of `count` tiles of a row (at `rowRect`) starting at `tile` (0 = north end). */
export function tileRect(rowRect: Rect, row: Row, tile: number, count = 1): Rect {
  return { x: rowRect.x, y: rowRect.y + tile * row.tileWidthMm, widthMm: rowRect.widthMm, depthMm: count * row.tileWidthMm };
}

/** Moves `id` to the slot whose centre is nearest `centerX` (a band being dragged sideways). */
export function reorderTo(l: DcLayout, id: string, centerX: number): string[] {
  const others = l.sequence.filter((x) => x !== id);
  const plan = computeFloorPlan({ ...l, sequence: others });
  const index = plan.bands.filter((b) => b.rect.x + b.rect.widthMm / 2 < centerX).length;
  return [...others.slice(0, index), id, ...others.slice(index)];
}

/** The aisle whose band is nearest `x` (mm), for dropping a tray. */
export function nearestAisle(plan: FloorPlan, x: number): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const b of plan.bands) {
    if (b.kind !== 'aisle') continue;
    const d = Math.abs(b.rect.x + b.rect.widthMm / 2 - x);
    if (!best || d < best.d) best = { id: b.id, d };
  }
  return best?.id;
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.widthMm && b.x < a.x + a.widthMm && a.y < b.y + b.depthMm && b.y < a.y + a.depthMm;

/** Arrangement problems: overflowing the rack area, facilities intruding into it. */
export function floorWarnings(l: DcLayout): string[] {
  const plan = computeFloorPlan(l);
  const ws = l.whitespace;
  const out: string[] = [];
  if (plan.usedWidthMm > ws.widthMm) out.push(`Rows and aisles need ${plan.usedWidthMm} mm; rack area is ${ws.widthMm} mm wide`);
  for (const r of l.rows) if (rowLength(r) > ws.depthMm) out.push(`${r.name} is ${rowLength(r)} mm long; rack area is ${ws.depthMm} mm deep`);
  for (const f of l.facilities) if (overlaps(f, ws)) out.push(`${f.name} overlaps the rack area`);
  for (const t of l.trays) if (!plan.rects.has(t.aisleId)) out.push(`Tray ${t.id} has no aisle`);
  return out;
}

