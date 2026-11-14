export const LAYOUT_SCHEMA = 'dc-lab/layout@1';

export type Compass = 'north' | 'south';

export interface Rect {
  x: number;
  y: number;
  widthMm: number;
  depthMm: number;
}

export interface Row {
  id: string;
  name: string;
  x: number;
  y: number;
  tileCount: number;
  tileWidthMm: number;
  tileDepthMm: number;
  powerBudgetKw: number;
  /** Side of the row facing the cold aisle. */
  frontFacing: Compass;
}

export interface Aisle extends Rect {
  id: string;
  kind: 'hot' | 'cold';
}

export interface CableTray extends Rect {
  id: string;
  kind: 'data' | 'power';
}

export interface RackAssignment {
  id: string;
  rowId: string;
  startTile: number;
  designId: string;
  label: string;
}

export interface DcLayout {
  schema?: typeof LAYOUT_SCHEMA;
  id: string;
  name: string;
  room: { widthMm: number; depthMm: number };
  rows: Row[];
  aisles: Aisle[];
  trays: CableTray[];
  assignments: RackAssignment[];
}
