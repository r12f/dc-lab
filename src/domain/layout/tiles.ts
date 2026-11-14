import type { Library } from '../library/library';
import type { RackDesign } from '../design/types';
import type { DcLayout, RackAssignment, Row } from './types';

export type DesignLookup = (id: string) => RackDesign | undefined;

/** Tiles an assigned design occupies (template footprint width, min 1). */
export function tileWidthOf(lib: Library, design: RackDesign | undefined): number {
  const rack = design && lib.racks.get(design.templateId);
  return Math.max(1, rack?.footprintTiles.wide ?? 1);
}

export function occupiedTiles(lib: Library, designs: DesignLookup, a: RackAssignment): number[] {
  const n = tileWidthOf(lib, designs(a.designId));
  return Array.from({ length: n }, (_, i) => a.startTile + i);
}

export function assignmentAt(
  lib: Library, designs: DesignLookup, layout: DcLayout, rowId: string, tile: number,
): RackAssignment | undefined {
  return layout.assignments.find((a) => a.rowId === rowId && occupiedTiles(lib, designs, a).includes(tile));
}

/** Why `designId` cannot start at `startTile` of `row`, or undefined. */
export function assignmentProblem(
  lib: Library, designs: DesignLookup, layout: DcLayout, row: Row,
  startTile: number, designId: string, ignoreId?: string,
): string | undefined {
  const design = designs(designId);
  if (!design) return 'Unknown rack design';
  const n = tileWidthOf(lib, design);
  if (startTile < 0 || startTile + n > row.tileCount) return `Needs ${n} tiles; row has ${row.tileCount - startTile} from here`;
  for (let t = startTile; t < startTile + n; t++) {
    const other = assignmentAt(lib, designs, layout, row.id, t);
    if (other && other.id !== ignoreId) return `Tile ${t + 1} is used by ${other.label}`;
  }
  return undefined;
}
