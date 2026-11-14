import type { ViewRotation } from './types';

/** Next rotation clockwise (+90) or counter-clockwise (-90). */
export function rotateBy(r: ViewRotation | undefined, step: 90 | -90): ViewRotation {
  return ((((r ?? 0) + step) % 360 + 360) % 360) as ViewRotation;
}

/** SVG transform that turns the plan (W x D mm, north up) by `r` clockwise, keeping it at the origin. */
export function planTransform(r: ViewRotation, widthMm: number, depthMm: number): string {
  switch (r) {
    case 90: return `translate(${depthMm} 0) rotate(90)`;
    case 180: return `translate(${widthMm} ${depthMm}) rotate(180)`;
    case 270: return `translate(0 ${widthMm}) rotate(270)`;
    default: return '';
  }
}

/** On-screen size of the plan after rotation. */
export function viewSize(r: ViewRotation, widthMm: number, depthMm: number): { w: number; h: number } {
  return r === 90 || r === 270 ? { w: depthMm, h: widthMm } : { w: widthMm, h: depthMm };
}

/** Angle in [-90, 90): text reads left-to-right, vertical text bottom-to-top (as before rotation), never upside down. */
function readable(a: number): number {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  if (x >= 90) x -= 180;
  if (x < -90) x += 180;
  return x;
}

/**
 * Local rotation for a label inside the rotated plan.
 * - `upright` labels stay horizontal on screen whatever the view rotation;
 * - `along` labels keep following their element (angle `a` in plan coordinates), flipped if they would read upside down.
 */
export function labelAngle(r: ViewRotation, mode: 'upright' | 'along', a = 0): number {
  return mode === 'upright' ? -r : readable(r + a) - r;
}

/** `rotate(...)` attribute for a label at (x, y), or undefined when no rotation is needed. */
export function labelTransform(r: ViewRotation, x: number, y: number, mode: 'upright' | 'along' = 'upright', a = 0): string | undefined {
  const deg = labelAngle(r, mode, a);
  return deg ? `rotate(${deg} ${x} ${y})` : undefined;
}

/** Plan-space width/height of a box as seen on screen (swapped at 90/270). */
export function screenBox(r: ViewRotation, w: number, h: number): { w: number; h: number } {
  return r === 90 || r === 270 ? { w: h, h: w } : { w, h };
}
