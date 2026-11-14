import type { CableTray, Aisle, DcLayout, Rect, Row } from './types';

/** Bounding rectangle of a vertical row. */
export function rowRect(row: Row): Rect {
  return { x: row.x, y: row.y, widthMm: row.tileDepthMm, depthMm: row.tileCount * row.tileWidthMm };
}

/** Rectangle of `count` tiles starting at `tile` (0 = north end). */
export function tileRect(row: Row, tile: number, count = 1): Rect {
  return { x: row.x, y: row.y + tile * row.tileWidthMm, widthMm: row.tileDepthMm, depthMm: count * row.tileWidthMm };
}

/** Right edge of the east-most element, or `margin` for an empty layout. */
export function eastEdge(l: DcLayout, margin = 1200): number {
  const rects: Rect[] = [...l.rows.map(rowRect), ...l.aisles, ...l.trays];
  return rects.length ? Math.max(...rects.map((r) => r.x + r.widthMm)) : margin;
}

export const SNAP_MM = 100;

export function snap(v: number, step = SNAP_MM): number {
  return Math.round(v / step) * step;
}

/** Clamps a top-left position so a `w`x`h` box stays inside the room. */
export function clampToRoom(l: DcLayout, x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, l.room.widthMm - w)),
    y: Math.min(Math.max(0, y), Math.max(0, l.room.depthMm - h)),
  };
}

export type MovableKind = 'row' | 'aisle' | 'tray';

export function movableRect(l: DcLayout, kind: MovableKind, id: string): Rect | undefined {
  if (kind === 'row') {
    const r = l.rows.find((x) => x.id === id);
    return r && rowRect(r);
  }
  const list: (Aisle | CableTray)[] = kind === 'aisle' ? l.aisles : l.trays;
  return list.find((x) => x.id === id);
}
