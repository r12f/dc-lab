export const LAYOUT_SCHEMA = 'dc-lab/layout@1';

/** Side of a (vertical) row facing the cold aisle. */
export type RowFront = 'east' | 'west';

export interface Rect {
  x: number;
  y: number;
  widthMm: number;
  depthMm: number;
}

/** A vertical (north–south) row of rack tiles; positioned by the layout sequence. */
export interface Row {
  id: string;
  name: string;
  tileCount: number;
  /** Tile pitch along the row (north–south). */
  tileWidthMm: number;
  /** Row depth across (east–west). */
  tileDepthMm: number;
  powerBudgetKw: number;
  frontFacing: RowFront;
}

/** A hot or cold aisle between rows; positioned by the layout sequence, spans the rack area depth. */
export interface Aisle {
  id: string;
  kind: 'hot' | 'cold';
  widthMm: number;
}

/** Overhead cable tray floating above an aisle, centred on it, full aisle length. */
export interface CableTray {
  id: string;
  kind: 'data' | 'power';
  aisleId: string;
  widthMm: number;
}

export type FacilityKind = 'pdu' | 'cooling' | 'other';

/** Support equipment around the rack area (power distribution, cooling units…). */
export interface Facility extends Rect {
  id: string;
  kind: FacilityKind;
  name: string;
  capacityKw?: number;
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
  /** Rack area inside the room; rows and aisles are packed inside it. */
  whitespace: Rect;
  facilities: Facility[];
  rows: Row[];
  aisles: Aisle[];
  /** Row and aisle ids from west to east. */
  sequence: string[];
  trays: CableTray[];
  assignments: RackAssignment[];
}
