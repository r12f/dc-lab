import type { Library } from '../../domain/library/library';
import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Rect, Row } from '../../domain/layout/types';
import { newAisle, newFacility, newRow, newTray } from '../../domain/layout/factory';
import { assignmentProblem, type DesignLookup } from '../../domain/layout/tiles';
import { clampToRoom, snap } from '../../domain/layout/geometry';
import { reorderTo } from '../../domain/layout/floor-plan';
import { duplicateElements, type DuplicableKind } from '../../domain/layout/duplicate';
import { uniqueId } from '../../domain/ids';
import { useAppStore } from '../../state/store';

type ListName = 'rows' | 'aisles' | 'trays' | 'facilities';
type Element = Row | Aisle | CableTray | Facility;

/** Commands on one DC layout. */
export function useLayoutEditor(lib: Library, designs: DesignLookup, layout: DcLayout | undefined) {
  const update = useAppStore((s) => s.update);
  const mutate = (fn: (l: DcLayout) => DcLayout) => layout && update('layouts', layout.id, fn);
  const allIds = (l: DcLayout) => [...l.rows, ...l.aisles].map((x) => x.id);

  // Rows and aisles append at the east end of the sequence, so row/aisle/row builds an aisle sequence.
  const addRow = () => mutate((l) => {
    const id = uniqueId('row', allIds(l));
    return { ...l, rows: [...l.rows, newRow(id, `Row ${l.rows.length + 1}`)], sequence: [...l.sequence, id] };
  });
  const addAisle = () => mutate((l) => {
    const id = uniqueId('aisle', allIds(l));
    return { ...l, aisles: [...l.aisles, newAisle(id)], sequence: [...l.sequence, id] };
  });
  /** Adds a tray over `aisleId`, or over the first aisle. */
  const addTray = (aisleId?: string) => mutate((l) => {
    const target = aisleId ?? l.sequence.find((id) => l.aisles.some((a) => a.id === id));
    if (!target) return l;
    return { ...l, trays: [...l.trays, newTray(uniqueId('tray', l.trays.map((t) => t.id)), target)] };
  });
  /** Adds a facility along the north wall, after the existing ones (drag it into place). */
  const addFacility = (kind: FacilityKind) => mutate((l) => {
    const x = Math.max(200, ...l.facilities.filter((f) => f.y < 1000).map((f) => f.x + f.widthMm + 200));
    const f = newFacility(uniqueId(kind, l.facilities.map((x) => x.id)), kind, 0, 200);
    return { ...l, facilities: [...l.facilities, { ...f, ...clampToRoom(l, x, 200, f.widthMm, f.depthMm) }] };
  });

  function updateElement<T extends Element>(list: ListName, id: string, patch: Partial<T>) {
    updateElements<T>(list, [id], patch);
  }
  /** Applies the same patch to several elements (batch edit). */
  function updateElements<T extends Element>(list: ListName, ids: string[], patch: Partial<T>) {
    mutate((l) => ({ ...l, [list]: (l[list] as Element[]).map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)) }));
  }
  /** Copies elements; returns the copies' ids (selected afterwards). */
  const duplicate = (kind: DuplicableKind, ids: string[]): string[] => {
    if (!layout) return [];
    const r = duplicateElements(layout, kind, ids);
    mutate(() => r.layout);
    return r.ids;
  };
  const removeElement = (list: ListName, id: string) => removeElements(list, [id]);
  const removeElements = (list: ListName, ids: string[]) =>
    mutate((l) => ({
      ...l,
      [list]: (l[list] as Element[]).filter((e) => !ids.includes(e.id)),
      sequence: l.sequence.filter((x) => !ids.includes(x)),
      trays: l.trays.filter((t) => !ids.includes(t.id) && !(list === 'aisles' && ids.includes(t.aisleId))),
      assignments: list === 'rows' ? l.assignments.filter((a) => !ids.includes(a.rowId)) : l.assignments,
    }));

  /** Re-orders a row/aisle so its band centre lands nearest `centerX`. */
  const reorder = (id: string, centerX: number) => mutate((l) => ({ ...l, sequence: reorderTo(l, id, centerX) }));
  const moveTray = (id: string, aisleId: string) => updateElement<CableTray>('trays', id, { aisleId });
  /** Moves a facility so its top-left is at (x, y), snapped and kept inside the room. */
  const moveFacility = (id: string, x: number, y: number) => mutate((l) => ({
    ...l,
    facilities: l.facilities.map((f) => (f.id === id ? { ...f, ...clampToRoom(l, snap(x), snap(y), f.widthMm, f.depthMm) } : f)),
  }));

  /** Assigns a design to a tile; returns an error message on failure. */
  const assign = (rowId: string, startTile: number, designId: string): string | undefined => {
    const row = layout?.rows.find((r) => r.id === rowId);
    if (!layout || !row) return 'Unknown row';
    const problem = assignmentProblem(lib, designs, layout, row, startTile, designId);
    if (problem) return problem;
    mutate((l) => {
      const id = uniqueId('r', l.assignments.map((a) => a.id));
      const label = `${row.name.replace(/\s+/g, '')}-${String(startTile + 1).padStart(2, '0')}`;
      return { ...l, assignments: [...l.assignments, { id, rowId, startTile, designId, label }] };
    });
    return undefined;
  };
  const unassign = (id: string) => mutate((l) => ({ ...l, assignments: l.assignments.filter((a) => a.id !== id) }));
  const relabel = (id: string, label: string) =>
    mutate((l) => ({ ...l, assignments: l.assignments.map((a) => (a.id === id ? { ...a, label } : a)) }));

  const setRoom = (room: DcLayout['room']) => mutate((l) => ({ ...l, room }));
  const setWhitespace = (whitespace: Rect) => mutate((l) => ({ ...l, whitespace }));
  const rename = (name: string) => mutate((l) => ({ ...l, name }));

  return {
    addRow, addAisle, addTray, addFacility, updateElement, updateElements, duplicate, removeElement, removeElements, reorder, moveTray, moveFacility,
    assign, unassign, relabel, setRoom, setWhitespace, rename,
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
