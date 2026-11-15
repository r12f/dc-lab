import type { Library } from '../library/library';
import type { DcLayout, RackAssignment } from './types';
import { rowOrder } from './floor-plan';
import { assignmentProblem, type DesignLookup } from './tiles';
import { rackLabel } from './assign';

export interface MoveResult {
  layout: DcLayout;
  /** Why the move cannot be made (nothing moved), e.g. "Row1-03: Overlaps Row2-04". */
  error?: string;
}

/**
 * Moves racks together: `dRow` rows east/west in row order (across row blocks) and `dTile` tiles along the row
 * (+ = south). Either every rack lands inside a row without overlapping a rack that stays, or nothing moves.
 * A label still in the automatic form (Row1-03) follows the new row / tile; a hand-set label is kept.
 */
export function moveAssignments(
  lib: Library, designs: DesignLookup, layout: DcLayout, ids: string[], dRow: number, dTile: number,
): MoveResult {
  const rows = rowOrder(layout);
  const index = new Map(rows.map((r, i) => [r.id, i]));
  const moving = layout.assignments.filter((a) => ids.includes(a.id));
  if (!moving.length || (dRow === 0 && dTile === 0)) return { layout };
  let next: DcLayout = { ...layout, assignments: layout.assignments.filter((a) => !ids.includes(a.id)) };
  const moved: RackAssignment[] = [];
  for (const a of moving) {
    const from = rows[index.get(a.rowId) ?? -1];
    const to = from && rows[index.get(a.rowId)! + dRow];
    if (!from || !to) return { layout, error: `${a.label}: no row there` };
    const start = a.startTile + dTile;
    const problem = assignmentProblem(lib, designs, next, to, start, a.designId);
    if (problem) return { layout, error: `${a.label}: ${problem}` };
    const label = a.label === rackLabel(from.name, a.startTile) ? rackLabel(to.name, start) : a.label;
    const m = { ...a, rowId: to.id, startTile: start, label };
    moved.push(m);
    next = { ...next, assignments: [...next.assignments, m] };
  }
  // Keep the original list order.
  const byId = new Map(moved.map((m) => [m.id, m]));
  return { layout: { ...layout, assignments: layout.assignments.map((a) => byId.get(a.id) ?? a) } };
}

/** Puts another design on racks in place; a rack the new design does not fit (wider, overlaps) is skipped. */
export function changeDesigns(
  lib: Library, designs: DesignLookup, layout: DcLayout, ids: string[], designId: string,
): { layout: DcLayout; changed: number; skipped: string[] } {
  let next = layout;
  let changed = 0;
  const skipped: string[] = [];
  for (const id of ids) {
    const a = next.assignments.find((x) => x.id === id);
    const row = a && next.rows.find((r) => r.id === a.rowId);
    if (!a || !row || a.designId === designId) continue;
    const problem = assignmentProblem(lib, designs, next, row, a.startTile, designId, a.id);
    if (problem) { skipped.push(`${a.label}: ${problem}`); continue; }
    next = { ...next, assignments: next.assignments.map((x) => (x.id === id ? { ...x, designId, serves: undefined } : x)) };
    changed++;
  }
  return { layout: next, changed, skipped };
}
