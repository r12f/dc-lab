import { uniqueId } from '../ids';
import { clampToRoom } from './geometry';
import { newAisle, newFacility, newRow, newTray } from './factory';
import type { DcLayout, FacilityKind } from './types';

/**
 * Where new elements go, derived from the current selection: the element it follows.
 * - `after`: row/aisle id in the sequence after which new rows/aisles are inserted (undefined = east end);
 * - `aisleId`: aisle a new tray goes over;
 * - `facilityId`: facility a new facility is placed next to.
 */
export interface InsertAnchor {
  after?: string;
  aisleId?: string;
  facilityId?: string;
  /** Door a new door is placed next to. */
  doorId?: string;
}

const pos = (l: DcLayout, id: string) => l.sequence.indexOf(id);
const isAisle = (l: DcLayout, id: string) => l.aisles.some((a) => a.id === id);

/** First aisle at or east of sequence index `from`, else the last aisle west of it. */
function aisleFrom(l: DcLayout, from: number): string | undefined {
  const east = l.sequence.slice(from).find((id) => isAisle(l, id));
  return east ?? [...l.sequence.slice(0, from)].reverse().find((id) => isAisle(l, id));
}

/** Inserts `id` into the sequence right after `after` (or at the east end). */
function insertAfter(seq: string[], after: string | undefined, id: string): string[] {
  const i = after ? seq.indexOf(after) : -1;
  return i < 0 ? [...seq, id] : [...seq.slice(0, i + 1), id, ...seq.slice(i + 1)];
}

export function addRowAfter(l: DcLayout, after?: string): { layout: DcLayout; id: string } {
  const id = uniqueId('row', [...l.rows, ...l.aisles].map((x) => x.id));
  const used = new Set(l.rows.map((r) => r.name));
  let n = l.rows.length + 1;
  while (used.has(`Row ${n}`)) n++;
  return { id, layout: { ...l, rows: [...l.rows, newRow(id, `Row ${n}`)], sequence: insertAfter(l.sequence, after, id) } };
}

export function addAisleAfter(l: DcLayout, after?: string): { layout: DcLayout; id: string } {
  const id = uniqueId('aisle', [...l.rows, ...l.aisles].map((x) => x.id));
  return { id, layout: { ...l, aisles: [...l.aisles, newAisle(id)], sequence: insertAfter(l.sequence, after, id) } };
}

/** Adds a tray over `aisleId`; without one, over the first aisle that has no tray yet (else the first aisle). */
export function addTrayOver(l: DcLayout, aisleId?: string): { layout: DcLayout; id?: string } {
  const aisles = l.sequence.filter((id) => isAisle(l, id));
  const target = aisleId ?? aisles.find((a) => !l.trays.some((t) => t.aisleId === a)) ?? aisles[0];
  if (!target) return { layout: l };
  const id = uniqueId('tray', l.trays.map((t) => t.id));
  return { id, layout: { ...l, trays: [...l.trays, newTray(id, target)] } };
}

/** Adds a facility right of `nextTo` (same row of equipment), else along the north wall after the others. */
export function addFacilityNear(l: DcLayout, kind: FacilityKind, nextTo?: string): { layout: DcLayout; id: string } {
  const id = uniqueId(kind, l.facilities.map((x) => x.id));
  const f = newFacility(id, kind, 0, 200);
  const ref = l.facilities.find((x) => x.id === nextTo);
  const x = ref ? ref.x + ref.widthMm + 200 : Math.max(200, ...l.facilities.filter((g) => g.y < 1000).map((g) => g.x + g.widthMm + 200));
  const y = ref ? ref.y : 200;
  return { id, layout: { ...l, facilities: [...l.facilities, { ...f, ...clampToRoom(l, x, y, f.widthMm, f.depthMm) }] } };
}

/**
 * Anchor for "add after the selection":
 * - rows/aisles: after the easternmost selected one; a tray: after its aisle; a tile or rack: after its row;
 * - trays go over the selected aisle, the selected tray's aisle (next aisle east), or the first aisle east
 *   of a selected row;
 * - facilities go next to the last selected facility.
 */
export function insertAnchor(
  l: DcLayout,
  sel: { kind: 'row' | 'aisle' | 'tray' | 'facility' | 'door'; ids: string[] } | { kind: 'tile'; tiles: { rowId: string; tile: number }[] } | { kind: 'assignment'; id: string } | undefined,
): InsertAnchor {
  if (!sel) return {};
  const last = (ids: string[]) => [...ids].sort((a, b) => pos(l, a) - pos(l, b)).at(-1);
  switch (sel.kind) {
    case 'row':
    case 'aisle': {
      const after = last(sel.ids);
      if (!after) return {};
      return { after, aisleId: sel.kind === 'aisle' ? after : aisleFrom(l, pos(l, after) + 1) };
    }
    case 'tray': {
      const trays = l.trays.filter((t) => sel.ids.includes(t.id));
      const after = last(trays.map((t) => t.aisleId));
      return after ? { after, aisleId: aisleFrom(l, pos(l, after) + 1) ?? after } : {};
    }
    case 'facility':
      return { facilityId: sel.ids.at(-1) };
    case 'door':
      return { doorId: sel.ids.at(-1) };
    case 'tile': {
      const rowId = sel.tiles.at(-1)?.rowId;
      return rowId ? { after: rowId, aisleId: aisleFrom(l, pos(l, rowId) + 1) } : {};
    }
    case 'assignment': {
      const rowId = l.assignments.find((a) => a.id === sel.id)?.rowId;
      return rowId ? { after: rowId, aisleId: aisleFrom(l, pos(l, rowId) + 1) } : {};
    }
  }
}
