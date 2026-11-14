import type { Aisle, CableTray, DcLayout, Row } from './types';
import { LAYOUT_SCHEMA } from './types';

export function newLayout(id: string, name: string): DcLayout {
  return {
    schema: LAYOUT_SCHEMA, id, name,
    room: { widthMm: 20000, depthMm: 16000 },
    rows: [], aisles: [], trays: [], assignments: [],
  };
}

/** A vertical row of 20 x 600 mm tiles, 1200 mm deep, at (x, y). */
export function newRow(id: string, name: string, x: number, y = 1200): Row {
  return {
    id, name, x, y, tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200,
    powerBudgetKw: 400, frontFacing: 'west',
  };
}

/** A vertical aisle matching a default row's length. */
export function newAisle(id: string, x: number, y = 1200): Aisle {
  return { id, kind: 'cold', x, y, widthMm: 1200, depthMm: 12000 };
}

export function newTray(id: string, x: number, y = 1200): CableTray {
  return { id, kind: 'data', x, y, widthMm: 300, depthMm: 12000 };
}
