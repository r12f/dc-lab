import type { Library } from '../library/library';
import { uniqueId } from '../ids';
import type { DcLayout } from './types';
import { assignmentAt, assignmentProblem, startInTile, type DesignLookup } from './tiles';

/** A tile on the floor: row and 0-based tile index. */
export interface TileRef {
  rowId: string;
  tile: number;
}

export interface AssignResult {
  layout: DcLayout;
  /** Ids of the new assignments, in tile order. */
  ids: string[];
  /** Per tile that got no rack: why ("Row 1 tile 3: Overlaps Row1-02"). */
  skipped: string[];
}

/** Label of a rack starting at `startTile` of a row: row name without spaces + 2-digit tile number ("Row1-03"). */
export function rackLabel(rowName: string, startTile: number): string {
  return `${rowName.replace(/\s+/g, '')}-${String(Math.floor(startTile) + 1).padStart(2, '0')}`;
}

/**
 * Assigns one design to several tiles, each in row order then tile order: every rack starts where its tile is free
 * (after a fractional rack ending inside it). A tile already covered — by an existing rack or one just placed
 * (a 2-tile rack covers the next selected tile) — or where the design does not fit is skipped with the reason.
 */
export function assignTiles(lib: Library, designs: DesignLookup, layout: DcLayout, tiles: TileRef[], designId: string): AssignResult {
  const order = (r: string) => layout.rows.findIndex((x) => x.id === r);
  const sorted = [...tiles].sort((a, b) => order(a.rowId) - order(b.rowId) || a.tile - b.tile);
  let l = layout;
  const ids: string[] = [];
  const skipped: string[] = [];
  for (const t of sorted) {
    const row = l.rows.find((r) => r.id === t.rowId);
    if (!row) continue;
    const where = `${row.name} tile ${t.tile + 1}`;
    const taken = assignmentAt(lib, designs, l, row.id, t.tile);
    if (taken) { skipped.push(`${where}: taken by ${taken.label}`); continue; }
    const start = startInTile(lib, designs, l, row.id, t.tile);
    const problem = assignmentProblem(lib, designs, l, row, start, designId);
    if (problem) { skipped.push(`${where}: ${problem}`); continue; }
    const id = uniqueId('r', l.assignments.map((a) => a.id));
    l = { ...l, assignments: [...l.assignments, { id, rowId: row.id, startTile: start, designId, label: rackLabel(row.name, start) }] };
    ids.push(id);
  }
  return { layout: l, ids, skipped };
}
