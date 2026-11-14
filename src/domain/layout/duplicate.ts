import { uniqueId } from '../ids';
import type { Aisle, CableTray, DcLayout, Facility, Row } from './types';

export type DuplicableKind = 'row' | 'aisle' | 'tray' | 'facility';

/** Next free "Row N" name. */
function nextRowName(rows: Row[]): string {
  const used = new Set(rows.map((r) => r.name));
  let n = rows.length + 1;
  while (used.has(`Row ${n}`)) n++;
  return `Row ${n}`;
}

/**
 * Copies the given elements; returns the new layout and the copies' ids.
 * - row: copy (with its racks, relabelled) inserted right after the original in the sequence;
 * - aisle: copy inserted right after the original;
 * - tray: copy over the nearest aisle to the east that has no tray of the same kind (else same aisle);
 * - facility: copy offset 200 mm south-east.
 */
export function duplicateElements(l: DcLayout, kind: DuplicableKind, ids: string[]): { layout: DcLayout; ids: string[] } {
  let next = l;
  const created: string[] = [];
  const takenIds = () => [...next.rows, ...next.aisles].map((x) => x.id);
  for (const id of ids) {
    if (kind === 'row') {
      const src = next.rows.find((r) => r.id === id);
      if (!src) continue;
      const copy: Row = { ...structuredClone(src), id: uniqueId('row', takenIds()), name: nextRowName(next.rows) };
      const taken = next.assignments.map((x) => x.id);
      const racks = next.assignments.filter((a) => a.rowId === id).map((a) => {
        const rid = uniqueId('r', taken);
        taken.push(rid);
        return { ...a, id: rid, rowId: copy.id, label: `${copy.name.replace(/\s+/g, '')}-${String(a.startTile + 1).padStart(2, '0')}` };
      });
      next = { ...next, rows: [...next.rows, copy], sequence: insertAfter(next.sequence, id, copy.id), assignments: [...next.assignments, ...racks] };
      created.push(copy.id);
    } else if (kind === 'aisle') {
      const src = next.aisles.find((a) => a.id === id);
      if (!src) continue;
      const copy: Aisle = { ...src, id: uniqueId('aisle', takenIds()) };
      next = { ...next, aisles: [...next.aisles, copy], sequence: insertAfter(next.sequence, id, copy.id) };
      created.push(copy.id);
    } else if (kind === 'tray') {
      const src = next.trays.find((t) => t.id === id);
      if (!src) continue;
      const aisleOrder = next.sequence.filter((x) => next.aisles.some((a) => a.id === x));
      const after = aisleOrder.slice(aisleOrder.indexOf(src.aisleId) + 1);
      const free = after.find((a) => !next.trays.some((t) => t.aisleId === a && t.kind === src.kind));
      const copy: CableTray = { ...src, id: uniqueId('tray', next.trays.map((t) => t.id)), aisleId: free ?? src.aisleId };
      next = { ...next, trays: [...next.trays, copy] };
      created.push(copy.id);
    } else {
      const src = next.facilities.find((f) => f.id === id);
      if (!src) continue;
      const copy: Facility = { ...src, id: uniqueId(src.kind, next.facilities.map((f) => f.id)), x: src.x + 200, y: src.y + 200 };
      next = { ...next, facilities: [...next.facilities, copy] };
      created.push(copy.id);
    }
  }
  return { layout: next, ids: created };
}

function insertAfter(seq: string[], after: string, id: string): string[] {
  const i = seq.indexOf(after);
  return i < 0 ? [...seq, id] : [...seq.slice(0, i + 1), id, ...seq.slice(i + 1)];
}
