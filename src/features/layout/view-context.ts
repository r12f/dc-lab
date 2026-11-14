import { createContext, useContext } from 'react';
import type { ViewRotation } from '../../domain/layout/types';
import { labelTransform, screenBox } from '../../domain/layout/view-rotation';

/** View rotation of the DC Layout canvas, for labels that must stay readable. */
export const ViewRotationContext = createContext<ViewRotation>(0);

export function useLabels() {
  const r = useContext(ViewRotationContext);
  return {
    rotation: r,
    /** Keep a label horizontal on screen. */
    upright: (x: number, y: number) => labelTransform(r, x, y, 'upright'),
    /** Keep a label along its element (plan angle `a`), never upside down. */
    along: (x: number, y: number, a: number) => labelTransform(r, x, y, 'along', a),
    /** Box size as seen on screen. */
    screen: (w: number, h: number) => screenBox(r, w, h),
  };
}
