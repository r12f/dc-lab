import { useState, type PointerEvent } from 'react';
import type { DcLayout } from '../../domain/layout/types';
import { computeFloorPlan, nearestAisle, reorderTo, trayRect } from '../../domain/layout/floor-plan';
import { clampToRoom, snap } from '../../domain/layout/geometry';
import { clampDoor, nearestWallSpot } from '../../domain/layout/doors';
import { toSvgPoint } from '../../io/svg-point';
import type { DragKind } from './selection';
import type { LayoutEditor } from './use-layout-editor';

interface Drag {
  kind: DragKind;
  id: string;
  /** Pointer position at press (mm). */
  x0: number;
  y0: number;
  /** Current pointer position (mm). */
  x: number;
  y: number;
  moved: boolean;
}

/** Threshold (mm) before a press becomes a drag, so a click still just selects. */
const DRAG_START_MM = 150;

/**
 * Pointer-driven arrangement on the layout SVG:
 * - row / aisle: dragged sideways to a new slot in the sequence (the plan re-packs live);
 * - tray: dragged onto another aisle;
 * - facility: moved freely (snapped, kept in the room).
 * `preview` is the layout as it would be after release; render it while dragging.
 */
export function useDragMove(layout: DcLayout, editor: LayoutEditor) {
  const [drag, setDrag] = useState<Drag>();

  const start = (kind: DragKind, id: string) => (e: PointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    const svg = e.currentTarget.closest('svg') as SVGSVGElement;
    const pt = toSvgPoint(svg, e.clientX, e.clientY);
    svg.setPointerCapture(e.pointerId);
    setDrag({ kind, id, x0: pt.x, y0: pt.y, x: pt.x, y: pt.y, moved: false });
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pt = toSvgPoint(e.currentTarget, e.clientX, e.clientY);
    const moved = drag.moved || Math.hypot(pt.x - drag.x0, pt.y - drag.y0) > DRAG_START_MM;
    setDrag({ ...drag, x: pt.x, y: pt.y, moved });
  };

  /** Layout with the drag applied (or the layout itself when not dragging). */
  const preview = (): DcLayout => {
    if (!drag?.moved) return layout;
    const dx = drag.x - drag.x0;
    const dy = drag.y - drag.y0;
    const plan = computeFloorPlan(layout);
    switch (drag.kind) {
      case 'row':
      case 'aisle': {
        const r = plan.rects.get(drag.id);
        return r ? { ...layout, sequence: reorderTo(layout, drag.id, r.x + r.widthMm / 2 + dx) } : layout;
      }
      case 'tray': {
        const t = layout.trays.find((x) => x.id === drag.id);
        const r = t && trayRect(plan, t);
        const aisleId = r && nearestAisle(plan, r.x + r.widthMm / 2 + dx);
        return aisleId ? { ...layout, trays: layout.trays.map((x) => (x.id === drag.id ? { ...x, aisleId } : x)) } : layout;
      }
      case 'facility':
        return {
          ...layout,
          facilities: layout.facilities.map((f) => (f.id === drag.id
            ? { ...f, ...clampToRoom(layout, snap(f.x + dx), snap(f.y + dy), f.widthMm, f.depthMm) } : f)),
        };
      case 'door': {
        // Doors slide along the walls: the pointer picks the nearest wall and the spot on it.
        const spot = nearestWallSpot(layout, drag.x, drag.y, layout.doors.find((d) => d.id === drag.id)?.widthMm ?? 0);
        return { ...layout, doors: layout.doors.map((d) => (d.id === drag.id ? clampDoor(layout, { ...d, ...spot }) : d)) };
      }
    }
  };

  /** Commits the drag. Returns true when something was dragged (callers then skip the click). */
  const end = (): boolean => {
    const d = drag;
    setDrag(undefined);
    if (!d?.moved) return false;
    const p = preview();
    if (d.kind === 'row' || d.kind === 'aisle') editor.reorder(d.id, centerOf(p, d.id));
    else if (d.kind === 'tray') {
      const t = p.trays.find((x) => x.id === d.id);
      if (t) editor.moveTray(d.id, t.aisleId);
    } else if (d.kind === 'door') {
      const door = p.doors.find((x) => x.id === d.id);
      if (door) editor.moveDoor(d.id, door.wall, door.offsetMm);
    } else {
      const f = p.facilities.find((x) => x.id === d.id);
      if (f) editor.moveFacility(d.id, f.x, f.y);
    }
    return true;
  };

  return { start, move, end, preview, dragging: drag?.moved ? drag : undefined };
}

function centerOf(l: DcLayout, id: string): number {
  const r = computeFloorPlan(l).rects.get(id);
  return r ? r.x + r.widthMm / 2 : 0;
}
