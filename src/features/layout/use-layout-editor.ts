import type { Library } from '../../domain/library/library';
import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Rect, Row } from '../../domain/layout/types';
import { addAisleAfter, addFacilityNear, addRowAfter, addTrayOver, type InsertAnchor } from '../../domain/layout/insert';
import { assignmentProblem, type DesignLookup } from '../../domain/layout/tiles';
import { clampToRoom, snap } from '../../domain/layout/geometry';
import { reorderTo } from '../../domain/layout/floor-plan';
import { duplicateElements, type DuplicableKind } from '../../domain/layout/duplicate';
import { uniqueId } from '../../domain/ids';
import { pruneFeeds, setFeed } from '../../domain/layout/power-feeds';
import { useAppStore } from '../../state/store';

type ListName = 'rows' | 'aisles' | 'trays' | 'facilities';
type Element = Row | Aisle | CableTray | Facility;

/** Commands on one DC layout. */
export function useLayoutEditor(lib: Library, designs: DesignLookup, layout: DcLayout | undefined) {
  const update = useAppStore((s) => s.update);
  const mutate = (fn: (l: DcLayout) => DcLayout) => layout && update('layouts', layout.id, fn);

  /** Applies a pure "add" to the layout and returns the new element's id (selected afterwards). */
  const add = (fn: (l: DcLayout) => { layout: DcLayout; id?: string }): string | undefined => {
    if (!layout) return undefined;
    const r = fn(layout);
    mutate(() => r.layout);
    return r.id;
  };
  // New rows/aisles go right after the anchor (the selection) in the sequence, else at the east end.
  const addRow = (anchor: InsertAnchor = {}) => add((l) => addRowAfter(l, anchor.after));
  const addAisle = (anchor: InsertAnchor = {}) => add((l) => addAisleAfter(l, anchor.after));
  const addTray = (anchor: InsertAnchor = {}) => add((l) => addTrayOver(l, anchor.aisleId));
  const addFacility = (kind: FacilityKind, anchor: InsertAnchor = {}) => add((l) => addFacilityNear(l, kind, anchor.facilityId));

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
    mutate((l) => pruneFeeds({
      ...l,
      [list]: (l[list] as Element[]).filter((e) => !ids.includes(e.id)),
      sequence: l.sequence.filter((x) => !ids.includes(x)),
      trays: l.trays.filter((t) => !ids.includes(t.id) && !(list === 'aisles' && ids.includes(t.aisleId))),
      assignments: list === 'rows' ? l.assignments.filter((a) => !ids.includes(a.rowId)) : l.assignments,
    }));
  /** Sets how many kW a PDU feeds into a row (0 removes the feed). */
  const setPowerFeed = (facilityId: string, rowId: string, kw: number) => mutate((l) => setFeed(l, facilityId, rowId, kw));

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
      // Numbered by the tile the rack starts in (a 1.5-tile rack at 1.5 is "-02").
      const label = `${row.name.replace(/\s+/g, '')}-${String(Math.floor(startTile) + 1).padStart(2, '0')}`;
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
    assign, unassign, relabel, setRoom, setWhitespace, rename, setPowerFeed,
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
