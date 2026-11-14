import { useState, type PointerEvent } from 'react';
import type { DcLayout } from '../../domain/layout/types';
import { clampToRoom, movableRect, snap, type MovableKind } from '../../domain/layout/geometry';
import { toSvgPoint } from '../../io/svg-point';

interface Drag {
  kind: MovableKind;
  id: string;
  /** Pointer offset from the element's top-left (mm). */
  dx: number;
  dy: number;
  x: number;
  y: number;
  moved: boolean;
}

/** Threshold (mm) before a press becomes a drag, so a click still just selects. */
const DRAG_START_MM = 150;

/**
 * Pointer-driven move of rows, aisles and trays on the layout SVG. While dragging, `offset(kind, id)`
 * gives the live translation to render; on release `onMove` commits the snapped position.
 */
export function useDragMove(layout: DcLayout, onMove: (kind: MovableKind, id: string, x: number, y: number) => void) {
  const [drag, setDrag] = useState<Drag>();
  const svgOf = (e: { currentTarget: Element }) => e.currentTarget.closest('svg') as SVGSVGElement;

  const start = (kind: MovableKind, id: string) => (e: PointerEvent<SVGElement>) => {
    const r = movableRect(layout, kind, id);
    if (!r || e.button !== 0) return;
    const svg = svgOf(e);
    const pt = toSvgPoint(svg, e.clientX, e.clientY);
    svg.setPointerCapture(e.pointerId);
    setDrag({ kind, id, dx: pt.x - r.x, dy: pt.y - r.y, x: r.x, y: r.y, moved: false });
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pt = toSvgPoint(e.currentTarget, e.clientX, e.clientY);
    const r = movableRect(layout, drag.kind, drag.id)!;
    const raw = { x: pt.x - drag.dx, y: pt.y - drag.dy };
    const moved = drag.moved || Math.hypot(raw.x - r.x, raw.y - r.y) > DRAG_START_MM;
    const pos = clampToRoom(layout, snap(raw.x), snap(raw.y), r.widthMm, r.depthMm);
    setDrag({ ...drag, ...pos, moved });
  };

  /** Returns true when a drag was committed (callers then skip the click). */
  const end = (): boolean => {
    const d = drag;
    setDrag(undefined);
    if (!d?.moved) return false;
    onMove(d.kind, d.id, d.x, d.y);
    return true;
  };

  const offset = (kind: MovableKind, id: string): { dx: number; dy: number } => {
    if (!drag?.moved || drag.kind !== kind || drag.id !== id) return { dx: 0, dy: 0 };
    const r = movableRect(layout, kind, id)!;
    return { dx: drag.x - r.x, dy: drag.y - r.y };
  };

  return { start, move, end, offset, dragging: drag?.moved ? drag : undefined };
}
