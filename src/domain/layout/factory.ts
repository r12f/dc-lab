import type { Aisle, CableTray, DcLayout, Row } from './types';
import { LAYOUT_SCHEMA } from './types';

export function newLayout(id: string, name: string): DcLayout {
  return {
    schema: LAYOUT_SCHEMA, id, name,
    room: { widthMm: 20000, depthMm: 12000 },
    rows: [], aisles: [], trays: [], assignments: [],
  };
}

export function newRow(id: string, name: string, y: number): Row {
  return {
    id, name, x: 1200, y, tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200,
    powerBudgetKw: 400, frontFacing: 'south',
  };
}

export function newAisle(id: string, y: number): Aisle {
  return { id, kind: 'cold', x: 1200, y, widthMm: 12000, depthMm: 1200 };
}

export function newTray(id: string, y: number): CableTray {
  return { id, kind: 'data', x: 1200, y, widthMm: 12000, depthMm: 300 };
}
