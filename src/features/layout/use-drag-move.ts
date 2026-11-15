import { useState, type PointerEvent } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { computeFloorPlan, nearestBand, reorderTo, rowOrder } from '../../domain/layout/floor-plan';
import { clampToRoom, snap } from '../../domain/layout/geometry';
import { clampDoor, nearestWallSpot } from '../../domain/layout/doors';
import { moveAssignments } from '../../domain/layout/move';
import type { DesignLookup } from '../../domain/layout/tiles';
import { toSvgPoint } from '../../io/svg-point';
import type { DragKind } from './selection';
import type { LayoutEditor } from './use-layout-editor';

interface Drag {
  kind: DragKind;
  id: string;
  /** Racks dragged together (the selection, when the pressed rack is in it). */
  ids: string[];
  /** Pointer position at press (mm). */
  x0: number;
  y0: number;
  /** Current pointer position (mm). */
  x: number;
  y: number;
  moved: boolean;
}

/** The rotated plan group: pointer positions are converted into plan (north-up mm) coordinates. */
function planSpace(svg: SVGSVGElement): SVGGraphicsElement {
  return (svg.querySelector('[data-plan]') as SVGGraphicsElement | null) ?? svg;
}

/** Threshold (mm) before a press becomes a drag, so a click still just selects. */
const DRAG_START_MM = 150;

/**
 * Pointer-driven arrangement on the layout SVG:
 * - row / aisle: dragged to a new slot in the sequence — sideways, or into another row block (the plan re-packs live);
 * - tray: dragged onto another row / aisle / cross aisle;
 * - rack(s): the selected racks move together by whole rows and tiles (all or none);
 * - facility: moved freely (snapped, kept in the room); door: along the walls.
 * `preview` is the layout as it would be after release; render it while dragging.
 */
export function useDragMove(lib: Library, designs: DesignLookup, layout: DcLayout, editor: LayoutEditor) {
  const [drag, setDrag] = useState<Drag>();

  const start = (kind: DragKind, id: string, ids: string[] = [id]) => (e: PointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    const svg = e.currentTarget.closest('svg') as SVGSVGElement;
    const pt = toSvgPoint(planSpace(svg), e.clientX, e.clientY);
    svg.setPointerCapture(e.pointerId);
    setDrag({ kind, id, ids, x0: pt.x, y0: pt.y, x: pt.x, y: pt.y, moved: false });
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pt = toSvgPoint(planSpace(e.currentTarget), e.clientX, e.clientY);
    const moved = drag.moved || Math.hypot(pt.x - drag.x0, pt.y - drag.y0) > DRAG_START_MM;
    setDrag({ ...drag, x: pt.x, y: pt.y, moved });
  };

  /** Whole rows / tiles a rack drag has moved: the row nearest the pointer vs the pressed rack's row. */
  const rackStep = (d: Drag): { dRow: number; dTile: number } => {
    const plan = computeFloorPlan(layout);
    const a = layout.assignments.find((x) => x.id === d.id);
    const order = rowOrder(layout);
    const from = order.findIndex((r) => r.id === a?.rowId);
    const row = order[from];
    const fromRect = row && plan.rects.get(row.id);
    if (!a || !row || !fromRect) return { dRow: 0, dTile: 0 };
    let best = { i: from, dist: Infinity };
    order.forEach((r, i) => {
      const rect = plan.rects.get(r.id);
      if (!rect) return;
      const dist = Math.hypot(Math.max(rect.x - d.x, 0, d.x - rect.x - rect.widthMm), Math.max(rect.y - d.y, 0, d.y - rect.y - rect.depthMm));
      if (dist < best.dist) best = { i, dist };
    });
    const to = order[best.i];
    const toRect = plan.rects.get(to.id)!;
    // Tile offset: where the pointer is in the target row vs where it was pressed in its own row.
    const t0 = (d.y0 - fromRect.y) / row.tileWidthMm;
    const t1 = (d.y - toRect.y) / to.tileWidthMm;
    return { dRow: best.i - from, dTile: Math.round(t1 - t0) };
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
        // The band's own centre, moved with the pointer, picks the row block and the slot in it.
        return r ? { ...layout, sequence: reorderTo(layout, drag.id, r.x + r.widthMm / 2 + dx, r.y + Math.min(r.depthMm, 2000) / 2 + dy) } : layout;
      }
      case 'tray': {
        const overId = nearestBand(plan, drag.x, drag.y);
        return overId ? { ...layout, trays: layout.trays.map((x) => (x.id === drag.id ? { ...x, overId, offsetMm: x.overId === overId ? x.offsetMm : undefined } : x)) } : layout;
      }
      case 'assignment': {
        const s = rackStep(drag);
        const r = moveAssignments(lib, designs, layout, drag.ids, s.dRow, s.dTile);
        return r.error ? layout : r.layout;
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
    return layout;
  };

  /** Commits the drag. Returns true when something was dragged (callers then skip the click). */
  const end = (): boolean => {
    const d = drag;
    setDrag(undefined);
    if (!d?.moved) return false;
    const p = preview();
    if (d.kind === 'row' || d.kind === 'aisle') editor.setSequence(p.sequence);
    else if (d.kind === 'tray') {
      const t = p.trays.find((x) => x.id === d.id);
      if (t) editor.moveTray(d.id, t.overId);
    } else if (d.kind === 'assignment') {
      const s = rackStep(d);
      editor.moveRacks(d.ids, s.dRow, s.dTile);
    } else if (d.kind === 'door') {
      const door = p.doors.find((x) => x.id === d.id);
      if (door) editor.moveDoor(d.id, door.wall, door.offsetMm);
    } else {
      const f = p.facilities.find((x) => x.id === d.id);
      if (f) editor.moveFacility(d.id, f.x, f.y);
    }
    return true;
  };

  /** While dragging racks: why they cannot go where the pointer is (shown on the canvas). */
  const rackProblem = (): string | undefined => {
    if (drag?.kind !== 'assignment' || !drag.moved) return undefined;
    const s = rackStep(drag);
    return moveAssignments(lib, designs, layout, drag.ids, s.dRow, s.dTile).error;
  };

  return { start, move, end, preview, rackProblem, dragging: drag?.moved ? drag : undefined };
}
