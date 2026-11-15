import type { Library } from '../library/library';
import type { RackDesign } from '../design/types';
import type { DcLayout, RackAssignment, Row } from './types';
import { footprintTiles } from '../rack/side-elements';

export type DesignLookup = (id: string) => RackDesign | undefined;

const EPS = 1e-9;

/** Tiles an assigned design occupies along the row: its template's computed footprint (may be half tiles, e.g. 1.5). */
export function tileWidthOf(lib: Library, design: RackDesign | undefined): number {
  const rack = design && lib.racks.get(design.templateId);
  return rack ? footprintTiles(rack).wide : 1;
}

/** Half-open span [start, end) of an assignment along its row, in tiles. */
export function spanOf(lib: Library, designs: DesignLookup, a: RackAssignment): { start: number; end: number } {
  return { start: a.startTile, end: a.startTile + tileWidthOf(lib, designs(a.designId)) };
}

/** Where a rack placed on `tile` starts: the tile edge, or right after a rack that ends inside the tile. */
export function startInTile(lib: Library, designs: DesignLookup, layout: DcLayout, rowId: string, tile: number): number {
  let start = tile;
  for (const a of layout.assignments) {
    if (a.rowId !== rowId) continue;
    const s = spanOf(lib, designs, a);
    if (s.start < start + EPS && s.end > start + EPS && s.end < tile + 1 - EPS) start = s.end;
  }
  return start;
}

/** The rack covering the free start point of `tile` (none when part of the tile is still free). */
export function assignmentAt(
  lib: Library, designs: DesignLookup, layout: DcLayout, rowId: string, tile: number,
): RackAssignment | undefined {
  const at = startInTile(lib, designs, layout, rowId, tile);
  return layout.assignments.find((a) => {
    if (a.rowId !== rowId) return false;
    const s = spanOf(lib, designs, a);
    return at >= s.start - EPS && at < s.end - EPS;
  });
}

/** Tiles used by racks (fractional widths summed). */
export function tilesUsed(lib: Library, designs: DesignLookup, assignments: RackAssignment[]): number {
  return assignments.reduce((n, a) => n + tileWidthOf(lib, designs(a.designId)), 0);
}

/** "1.5" / "3" — tile counts without trailing zeros. */
export function formatTiles(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Why `designId` cannot start at `startTile` of `row`, or undefined. */
export function assignmentProblem(
  lib: Library, designs: DesignLookup, layout: DcLayout, row: Row,
  startTile: number, designId: string, ignoreId?: string,
): string | undefined {
  const design = designs(designId);
  if (!design) return 'Unknown rack design';
  const n = tileWidthOf(lib, design);
  const end = startTile + n;
  if (startTile < 0 || end > row.tileCount + EPS) {
    return `Needs ${formatTiles(n)} tiles; row has ${formatTiles(row.tileCount - startTile)} from here`;
  }
  for (const other of layout.assignments) {
    if (other.rowId !== row.id || other.id === ignoreId) continue;
    const s = spanOf(lib, designs, other);
    if (startTile < s.end - EPS && s.start < end - EPS) return `Overlaps ${other.label}`;
  }
  return undefined;
}
