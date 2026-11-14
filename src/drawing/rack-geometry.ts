import type { RackTemplate } from '../domain/rack/types';
import { elementsOn, type SideElement, type SideName } from '../domain/rack/side-elements';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SideElementBox extends Rect {
  element: SideElement;
}

/** Pixel geometry of a rack elevation drawing (shared by Racks and Rack Designer). */
export interface RackGeometry {
  unitPx: number;
  railW: number;
  bodyW: number;
  /** Left edge of the rails. */
  originX: number;
  originY: number;
  bodyH: number;
  sideBoxes: SideElementBox[];
  width: number;
  height: number;
}

/** Horizontal scale: rack body and side elements are drawn to this many px per mm. */
export const PX_PER_MM = 0.5;
const RAIL_W = 26;
const SIDE_GAP = 4;
const MIN_BODY_PX = 220;

function sideWidth(elements: SideElement[]): number {
  return elements.reduce((n, e) => n + Math.max(12, e.widthMm * PX_PER_MM) + SIDE_GAP, 0);
}

export function rackGeometry(rack: RackTemplate): RackGeometry {
  const unitPx = 18;
  const left = elementsOn(rack.sideElements, 'left');
  const right = elementsOn(rack.sideElements, 'right');
  const bodyOuter = Math.max(MIN_BODY_PX + RAIL_W * 2, rack.widthMm * PX_PER_MM);
  const bodyW = bodyOuter - RAIL_W * 2;
  const originX = sideWidth(left);
  const originY = 48;
  const bodyH = rack.units * unitPx;

  const sideBoxes: SideElementBox[] = [];
  const place = (list: SideElement[], side: SideName) => {
    // Ordered from the body outward.
    let edge = side === 'left' ? originX : originX + bodyOuter;
    for (const element of list) {
      const w = Math.max(12, element.widthMm * PX_PER_MM);
      const x = side === 'left' ? edge - SIDE_GAP - w : edge + SIDE_GAP;
      sideBoxes.push({ element, x, y: originY - 4, w, h: bodyH + 8 });
      edge = side === 'left' ? x : x + w;
    }
  };
  place(left, 'left');
  place(right, 'right');

  return {
    unitPx, railW: RAIL_W, bodyW, originX, originY, bodyH, sideBoxes,
    width: originX + bodyOuter + sideWidth(right),
    height: originY + bodyH + 30,
  };
}

/** Top y of unit `u` (1 = bottom). */
export function unitTopY(g: RackGeometry, rack: RackTemplate, u: number): number {
  return g.originY + (rack.units - u) * g.unitPx;
}

export function bodyX(g: RackGeometry): number {
  return g.originX + g.railW;
}

/** Unit under svg y, clamped to the rack. */
export function unitAtY(g: RackGeometry, rack: RackTemplate, y: number): number {
  const u = rack.units - Math.floor((y - g.originY) / g.unitPx);
  return Math.min(rack.units, Math.max(1, u));
}

export function sideBox(g: RackGeometry, elementId: string): SideElementBox | undefined {
  return g.sideBoxes.find((b) => b.element.id === elementId);
}

const SLOT_PAD = 3;

/** Slot `slot` (1 = top) inside a side element box. */
export function sideSlotRect(box: SideElementBox, slot: number): Rect {
  const n = Math.max(1, box.element.slots);
  const h = (box.h - SLOT_PAD * 2) / n;
  return { x: box.x + SLOT_PAD, y: box.y + SLOT_PAD + (slot - 1) * h, w: box.w - SLOT_PAD * 2, h };
}

/** Side element and slot under an svg point, if any. */
export function sideSlotAt(g: RackGeometry, x: number, y: number): { elementId: string; slot: number } | undefined {
  const box = g.sideBoxes.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  if (!box || box.element.slots < 1) return undefined;
  const h = (box.h - SLOT_PAD * 2) / box.element.slots;
  const slot = Math.min(box.element.slots, Math.max(1, Math.floor((y - box.y - SLOT_PAD) / h) + 1));
  return { elementId: box.element.id, slot };
}
