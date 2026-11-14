import type { DcLayout } from './types';

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
