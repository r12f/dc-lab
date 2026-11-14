import type { RackTemplate } from '../domain/rack/types';
import type { SideName } from '../domain/design/types';

/** Pixel geometry of a rack elevation drawing (shared by Racks and Rack Designer). */
export interface RackGeometry {
  unitPx: number;
  railW: number;
  bodyW: number;
  podW: number;
  podSlotH: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const SIDE_SLOT_PX = 90;

export function rackGeometry(rack: RackTemplate): RackGeometry {
  const unitPx = 18;
  const railW = 26;
  const bodyW = 300;
  const hasPods = rack.sidePods.left + rack.sidePods.right > 0;
  const podW = hasPods ? 34 : 0;
  const originX = podW + 8;
  const originY = 40;
  const bodyH = rack.units * unitPx;
  const maxSlots = Math.max(rack.sidePods.left, rack.sidePods.right, 1);
  return {
    unitPx, railW, bodyW, podW,
    podSlotH: bodyH / maxSlots,
    originX, originY,
    width: originX * 2 + railW * 2 + bodyW,
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

export function sideSlotRect(g: RackGeometry, side: SideName, slot: number) {
  const x = side === 'left' ? 4 : g.width - g.podW - 4;
  return { x, y: g.originY + (slot - 1) * g.podSlotH, w: g.podW, h: g.podSlotH };
}
