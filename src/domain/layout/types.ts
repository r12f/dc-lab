export const LAYOUT_SCHEMA = 'dc-lab/layout@1';

/** Side of a (vertical) row facing the cold aisle. */
export type RowFront = 'east' | 'west';

export interface Rect {
  x: number;
  y: number;
  widthMm: number;
  depthMm: number;
}

/** A vertical (north–south) row of rack tiles. */
export interface Row {
  id: string;
  name: string;
  /** Top-left corner (mm). */
  x: number;
  y: number;
  tileCount: number;
  /** Tile pitch along the row (north–south). */
  tileWidthMm: number;
  /** Row depth across (east–west). */
  tileDepthMm: number;
  powerBudgetKw: number;
  frontFacing: RowFront;
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
