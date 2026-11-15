import { addDoor } from './doors';
import { uniqueId } from '../ids';
import type { Aisle, CableTray, DcLayout, Facility, Row } from './types';

export type DuplicableKind = 'row' | 'aisle' | 'tray' | 'facility' | 'door';

/** Next free "Row N" name. */
function nextRowName(rows: Row[]): string {
  const used = new Set(rows.map((r) => r.name));
  let n = rows.length + 1;
  while (used.has(`Row ${n}`)) n++;
  return `Row ${n}`;
}

/**
 * Copies the given elements; returns the new layout and the copies' ids.
 * - row: copy (with its racks, relabelled) added at the east end of the sequence;
 * - aisle: copy added at the east end of the sequence;
 *   several rows/aisles are copied in their west-to-east order, so a selected block repeats as a block;
 * - tray: copy over the nearest aisle to the east that has no tray of the same kind (else same aisle);
 * - facility: copy offset 200 mm south-east.
 */
export function duplicateElements(l: DcLayout, kind: DuplicableKind, ids: string[]): { layout: DcLayout; ids: string[] } {
  let next = l;
  const created: string[] = [];
  const takenIds = () => [...next.rows, ...next.aisles].map((x) => x.id);
  // Rows/aisles copy in west-to-east order so the copies keep the originals' order.
  const ordered = kind === 'row' || kind === 'aisle' ? [...ids].sort((a, b) => l.sequence.indexOf(a) - l.sequence.indexOf(b)) : ids;
  for (const id of ordered) {
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
      next = { ...next, rows: [...next.rows, copy], sequence: [...next.sequence, copy.id], assignments: [...next.assignments, ...racks] };
      created.push(copy.id);
    } else if (kind === 'aisle') {
      const src = next.aisles.find((a) => a.id === id);
      if (!src) continue;
      const copy: Aisle = { ...src, id: uniqueId('aisle', takenIds()) };
      next = { ...next, aisles: [...next.aisles, copy], sequence: [...next.sequence, copy.id] };
      created.push(copy.id);
    } else if (kind === 'tray') {
      const src = next.trays.find((t) => t.id === id);
      if (!src) continue;
      // Next band of the same sort (row / aisle / cross aisle) east that has no tray of this kind.
      const sortOf = (id: string) => (next.rows.some((r) => r.id === id) ? 'row' : next.aisles.find((a) => a.id === id)?.cross ? 'cross' : 'aisle');
      const same = next.sequence.filter((x) => sortOf(x) === sortOf(src.overId));
      const after = same.slice(same.indexOf(src.overId) + 1);
      const free = after.find((a) => !next.trays.some((t) => t.overId === a && t.kind === src.kind));
      const copy: CableTray = { ...src, id: uniqueId('tray', next.trays.map((t) => t.id)), overId: free ?? src.overId };
      next = { ...next, trays: [...next.trays, copy] };
      created.push(copy.id);
    } else if (kind === 'door') {
      const r = addDoor(next, id);
      next = r.layout;
      created.push(r.id);
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
