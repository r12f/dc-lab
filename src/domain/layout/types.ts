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

/**
 * A hot or cold aisle; positioned by the layout sequence. A lengthwise aisle runs between rows of a row block and
 * spans its depth. A **cross aisle** (`cross`) runs east–west across the whole rack area and splits the sequence
 * into row blocks (rows of rows) stacked north to south; `widthMm` is then its north–south width.
 */
export interface Aisle {
  id: string;
  kind: 'hot' | 'cold';
  widthMm: number;
  cross?: boolean;
}

/**
 * Overhead cable tray floating over a band — an aisle, a cross aisle, or a row (over the tops of its racks) —
 * running its full length, centred on it and shifted `offsetMm` across it (+ = east / south).
 */
export interface CableTray {
  id: string;
  kind: 'data' | 'power';
  /** Row or aisle id the tray runs over. */
  overId: string;
  widthMm: number;
  offsetMm?: number;
}

export type FacilityKind = 'pdu' | 'cooling' | 'other';

/** Support equipment around the rack area (power distribution, cooling units…). */
export interface Facility extends Rect {
  id: string;
  kind: FacilityKind;
  name: string;
  /** Device item this facility is (DC PDU, cooling unit); supplies the default max power. */
  deviceId?: string;
  /** Max power (kW): PDU supply / cooling capacity. Unset = the device item's value. */
  capacityKw?: number;
  /** PDU: rows it feeds. Each row's demand is computed and split evenly over the PDUs feeding it. */
  rowIds?: string[];
  /** Cooling: hot aisles it serves. Each aisle's heat is computed and split evenly over its units. */
  aisleIds?: string[];
}

export type Wall = 'north' | 'south' | 'east' | 'west';

export type ViewRotation = 0 | 90 | 180 | 270;

/** A door in a room wall: `offsetMm` from the wall's west (north/south walls) or north (east/west walls) end. */
export interface Door {
  id: string;
  name: string;
  wall: Wall;
  offsetMm: number;
  widthMm: number;
  /** Main entrance (drawn bolder) vs other doors (fire exit, loading). */
  kind: 'entry' | 'exit';
  /** How it opens; default swing in. */
  swing?: DoorSwing;
}

export type DoorSwing = 'in' | 'out' | 'slide-left' | 'slide-right';

export interface RackAssignment {
  id: string;
  rowId: string;
  startTile: number;
  designId: string;
  label: string;
  /** Power / CDU racks only: ids of the IT racks this rack serves (default: the adjacent IT racks in its row). */
  serves?: string[];
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
  /** Row and aisle ids from west to east; a cross aisle starts the next row block (south). */
  sequence: string[];
  trays: CableTray[];
  assignments: RackAssignment[];
  /** Doors in the room walls. */
  doors: Door[];
  /** View rotation, clockwise degrees (display only; the plan itself stays north-up). Default 0. */
  viewRotation?: ViewRotation;
}
