import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Row } from './types';
import { LAYOUT_SCHEMA } from './types';

/** 20 x 16 m hall with a 14 x 12 m rack area in the middle; facilities go around it. */
export function newLayout(id: string, name: string): DcLayout {
  return {
    schema: LAYOUT_SCHEMA, id, name,
    room: { widthMm: 20000, depthMm: 16000 },
    whitespace: { x: 3000, y: 2000, widthMm: 14000, depthMm: 12000 },
    facilities: [], rows: [], aisles: [], sequence: [], trays: [], assignments: [],
  };
}

/** A vertical row of 20 x 600 mm tiles, 1200 mm deep. */
export function newRow(id: string, name: string): Row {
  return { id, name, tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200, powerBudgetKw: 400, frontFacing: 'west' };
}

export function newAisle(id: string): Aisle {
  return { id, kind: 'cold', widthMm: 1200 };
}

export function newTray(id: string, aisleId: string): CableTray {
  return { id, kind: 'data', aisleId, widthMm: 600 };
}

const FACILITY_DEFAULTS: Record<FacilityKind, { name: string; widthMm: number; depthMm: number }> = {
  pdu: { name: 'PDU', widthMm: 1200, depthMm: 800 },
  cooling: { name: 'CRAH', widthMm: 2400, depthMm: 900 },
  other: { name: 'Facility', widthMm: 1200, depthMm: 1200 },
};

export function newFacility(id: string, kind: FacilityKind, x: number, y: number): Facility {
  const d = FACILITY_DEFAULTS[kind];
  return { id, kind, name: d.name, x, y, widthMm: d.widthMm, depthMm: d.depthMm };
}
