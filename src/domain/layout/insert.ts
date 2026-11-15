import { uniqueId } from '../ids';
import { clampToRoom } from './geometry';
import { newAisle, newCrossAisle, newFacility, newFloatingTray, newRow, newTray } from './factory';
import { computeFloorPlan } from './floor-plan';
import { snap } from './geometry';
import type { DcLayout, FacilityKind } from './types';

/**
 * Where new elements go, derived from the current selection: the element it follows.
 * - `after`: row/aisle id in the sequence after which new rows/aisles are inserted (undefined = east end);
 * - `overId`: aisle a new aisle tray goes over;
 * - `rows` / `y`: rows a new floating tray spans (first..last) and where it goes north–south;
 * - `facilityId`: facility a new facility is placed next to.
 */
export interface InsertAnchor {
  after?: string;
  overId?: string;
  rows?: string[];
  y?: number;
  facilityId?: string;
  /** Door a new door is placed next to. */
  doorId?: string;
}

const pos = (l: DcLayout, id: string) => l.sequence.indexOf(id);
const isAisle = (l: DcLayout, id: string) => l.aisles.some((a) => a.id === id && !a.cross);

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

export function addAisleAfter(l: DcLayout, after?: string, cross = false): { layout: DcLayout; id: string } {
  const id = uniqueId('aisle', [...l.rows, ...l.aisles].map((x) => x.id));
  return { id, layout: { ...l, aisles: [...l.aisles, cross ? newCrossAisle(id) : newAisle(id)], sequence: insertAfter(l.sequence, after, id) } };
}

/**
 * Adds a floating tray across the rows: from the westmost to the eastmost of `rows` (default: every row of the first
 * row block), at `y` (default: the middle of that block), snapped to 100 mm.
 */
export function addFloatingTray(l: DcLayout, rows?: string[], y?: number): { layout: DcLayout; id?: string } {
  const plan = computeFloorPlan(l);
  const inSeq = (ids: string[]) => [...ids].filter((x) => plan.rects.has(x)).sort((a, b) => pos(l, a) - pos(l, b));
  const block0 = plan.bands.filter((b) => b.block === 0 && !b.cross).map((b) => b.id);
  const span = inSeq(rows?.length ? rows : block0);
  if (!span.length) return { layout: l };
  const first = plan.rects.get(span[0])!;
  const id = uniqueId('tray', l.trays.map((t) => t.id));
  const at = snap(y ?? first.y + Math.min(first.depthMm, plan.blocks[0]?.depthMm ?? first.depthMm) / 2);
  return { id, layout: { ...l, trays: [...l.trays, newFloatingTray(id, span[0], span[span.length - 1], at)] } };
}

/** Adds an aisle tray over `overId`; without one, over the first aisle that has no tray yet (else the first aisle). */
export function addTrayOver(l: DcLayout, overId?: string): { layout: DcLayout; id?: string } {
  const aisles = l.sequence.filter((id) => isAisle(l, id));
  const target = overId ?? aisles.find((a) => !l.trays.some((t) => t.overId === a)) ?? aisles[0];
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
 * - rows/aisles: after the last selected one in the sequence; a tray: after its band; a tile or rack: after its row;
 * - trays go over the selected row / aisle / cross aisle, the next aisle east of a selected tray's band, or the
 *   row of a selected tile / rack;
 * - facilities go next to the last selected facility.
 */
export function insertAnchor(
  l: DcLayout,
  sel: { kind: 'row' | 'aisle' | 'tray' | 'facility' | 'door' | 'assignment'; ids: string[] } | { kind: 'tile'; tiles: { rowId: string; tile: number }[] } | undefined,
): InsertAnchor {
  if (!sel) return {};
  const last = (ids: string[]) => [...ids].sort((a, b) => pos(l, a) - pos(l, b)).at(-1);
  switch (sel.kind) {
    case 'row':
    case 'aisle': {
      const after = last(sel.ids);
      if (!after) return {};
      return { after, overId: sel.kind === 'aisle' ? after : aisleFrom(l, pos(l, after) + 1), rows: sel.kind === 'row' ? sel.ids : undefined };
    }
    case 'tray': {
      const trays = l.trays.filter((t) => sel.ids.includes(t.id));
      const after = last(trays.map((t) => t.overId).filter((x): x is string => !!x));
      const fl = trays.find((t) => t.floating);
      // Next floating tray: same span, 1.2 m further south.
      const floating = fl ? { rows: [fl.fromId!, fl.toId!], y: (fl.y ?? 0) + 1200 } : {};
      return after ? { after, overId: aisleFrom(l, pos(l, after) + 1) ?? after, ...floating } : floating;
    }
    case 'facility':
      return { facilityId: sel.ids.at(-1) };
    case 'door':
      return { doorId: sel.ids.at(-1) };
    case 'tile': {
      const t = sel.tiles.at(-1);
      if (!t) return {};
      const r = computeFloorPlan(l).rects.get(t.rowId);
      const row = l.rows.find((x) => x.id === t.rowId);
      // A floating tray goes across the selected tiles' rows, at the last tile.
      const y = r && row ? r.y + t.tile * row.tileWidthMm : undefined;
      return { after: t.rowId, overId: aisleFrom(l, pos(l, t.rowId) + 1), rows: [...new Set(sel.tiles.map((x) => x.rowId))], y };
    }
    case 'assignment': {
      const racks = l.assignments.filter((a) => sel.ids.includes(a.id));
      const rowId = racks.at(-1)?.rowId;
      return rowId ? { after: rowId, overId: aisleFrom(l, pos(l, rowId) + 1), rows: [...new Set(racks.map((a) => a.rowId))] } : {};
    }
  }
}
