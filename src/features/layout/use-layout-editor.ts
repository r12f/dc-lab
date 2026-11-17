import type { Library } from '../../domain/library/library';
import type { Aisle, CableTray, DcLayout, Door, Facility, FacilityKind, Rect, Row, Wall } from '../../domain/layout/types';
import { addDoor, clampDoor } from '../../domain/layout/doors';
import { rotateBy } from '../../domain/layout/view-rotation';
import { addAisleAfter, addFacilityNear, addFloatingTray, addRowAfter, addTrayOver, type InsertAnchor } from '../../domain/layout/insert';
import { assignmentProblem, type DesignLookup } from '../../domain/layout/tiles';
import { assignTiles as assignTilesTo, rackLabel, type AssignResult, type TileRef } from '../../domain/layout/assign';
import { clampToRoom, snap } from '../../domain/layout/geometry';
import { reorderTo } from '../../domain/layout/floor-plan';
import { duplicateElements, type DuplicableKind } from '../../domain/layout/duplicate';
import { changeDesigns, moveAssignments } from '../../domain/layout/move';
import { uniqueId } from '../../domain/ids';
import { pruneFacilityLinks } from '../../domain/layout/facility-load';
import { useAppStore } from '../../state/store';

type ListName = 'rows' | 'aisles' | 'trays' | 'facilities' | 'doors';
type Element = Row | Aisle | CableTray | Facility | Door;

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
  /** Cross aisle after the selection: everything after it forms the next row block (south). */
  const addCrossAisle = (anchor: InsertAnchor = {}) => add((l) => addAisleAfter(l, anchor.after, true));
  const addTray = (anchor: InsertAnchor = {}) => add((l) => addTrayOver(l, anchor.overId));
  /** Floating tray across the selected rows (default: the first row block), at the selection's position. */
  const addFloating = (anchor: InsertAnchor = {}) => add((l) => addFloatingTray(l, anchor.rows, anchor.y));
  const addFacility = (kind: FacilityKind, anchor: InsertAnchor = {}) => add((l) => addFacilityNear(l, kind, anchor.facilityId));
  const addDoorTo = (anchor: InsertAnchor = {}) => add((l) => addDoor(l, anchor.doorId));
  /** Moves a door to a wall position (kept on the wall). */
  const moveDoor = (id: string, wall: Wall, offsetMm: number) => mutate((l) => ({
    ...l, doors: l.doors.map((d) => (d.id === id ? clampDoor(l, { ...d, wall, offsetMm }) : d)),
  }));

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
    mutate((l) => pruneFacilityLinks({
      ...l,
      [list]: (l[list] as Element[]).filter((e) => !ids.includes(e.id)),
      sequence: l.sequence.filter((x) => !ids.includes(x)),
      // Trays over / spanning a deleted band go with it.
      trays: l.trays.filter((t) => !ids.includes(t.id) && ![t.overId, t.fromId, t.toId].some((x) => x && ids.includes(x))),
      assignments: list === 'rows' ? l.assignments.filter((a) => !ids.includes(a.rowId)) : l.assignments,
    }));
  /** Rows a PDU feeds / hot aisles a cooling unit serves. */
  const setFacilityLinks = (id: string, patch: Pick<Facility, 'rowIds'> | Pick<Facility, 'aisleIds'>) =>
    mutate((l) => ({ ...l, facilities: l.facilities.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));

  /** Re-orders a row/aisle so its band centre lands nearest `centerX` (in the row block under `centerY`). */
  const reorder = (id: string, centerX: number, centerY?: number) => mutate((l) => ({ ...l, sequence: reorderTo(l, id, centerX, centerY) }));
  const setSequence = (sequence: string[]) => mutate((l) => ({ ...l, sequence }));
  /** Moves a floating tray north–south: north edge at `y`, snapped to 100 mm and kept in the room. */
  const moveFloatingTray = (id: string, y: number) => mutate((l) => ({
    ...l, trays: l.trays.map((t) => (t.id === id ? { ...t, y: Math.max(0, Math.min(l.room.depthMm - t.widthMm, snap(y))) } : t)),
  }));
  /** Moves an aisle tray over another aisle (centred there). */
  const moveTray = (id: string, overId: string) => mutate((l) => ({
    ...l, trays: l.trays.map((t) => (t.id === id ? { ...t, overId, offsetMm: t.overId === overId ? t.offsetMm : undefined } : t)),
  }));
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
      const label = rackLabel(row.name, startTile);
      return { ...l, assignments: [...l.assignments, { id, rowId, startTile, designId, label }] };
    });
    return undefined;
  };
  /** Assigns one design to several tiles (tiles already taken or too short are skipped and reported). */
  const assignTiles = (tiles: TileRef[], designId: string): AssignResult => {
    if (!layout) return { layout: layout as never, ids: [], skipped: [] };
    const r = assignTilesTo(lib, designs, layout, tiles, designId);
    if (r.ids.length) mutate(() => r.layout);
    return r;
  };
  const unassign = (id: string) => unassignAll([id]);
  /** Removes racks (and drops them from power / CDU racks' serve lists). */
  const unassignAll = (ids: string[]) => mutate((l) => ({
    ...l,
    assignments: l.assignments.filter((a) => !ids.includes(a.id))
      .map((a) => (a.serves?.some((x) => ids.includes(x)) ? { ...a, serves: a.serves.filter((x) => !ids.includes(x)) } : a)),
    crossCables: l.crossCables?.filter((c) => ![...c.from, ...c.to].some((e) => ids.includes(e.assignmentId))),
  }));
  /** Moves racks together by rows (in row order) and tiles; all or none. Returns the problem when they do not fit. */
  const moveRacks = (ids: string[], dRow: number, dTile: number): string | undefined => {
    if (!layout) return 'No layout';
    const r = moveAssignments(lib, designs, layout, ids, dRow, dTile);
    if (!r.error) mutate(() => r.layout);
    return r.error;
  };
  /** Puts another design on the racks in place (racks it does not fit are skipped). */
  const changeDesign = (ids: string[], designId: string) => {
    if (!layout) return { changed: 0, skipped: [] as string[] };
    const r = changeDesigns(lib, designs, layout, ids, designId);
    if (r.changed) mutate(() => r.layout);
    return r;
  };
  /** Sets which IT racks a power / CDU rack serves; undefined = the adjacent IT racks (default). */
  const setServes = (id: string, serves: string[] | undefined) =>
    mutate((l) => ({ ...l, assignments: l.assignments.map((a) => (a.id === id ? { ...a, serves } : a)) }));
  const relabel = (id: string, label: string) =>
    mutate((l) => ({ ...l, assignments: l.assignments.map((a) => (a.id === id ? { ...a, label } : a)) }));

  /** Replaces the layout's cross-rack cables. */
  const setCrossCables = (crossCables: DcLayout['crossCables']) => mutate((l) => ({ ...l, crossCables }));
  const setRoom = (room: DcLayout['room']) => mutate((l) => ({ ...l, room }));
  const setWhitespace = (whitespace: Rect) => mutate((l) => ({ ...l, whitespace }));
  const rename = (name: string) => mutate((l) => ({ ...l, name }));
  /** Turns the view 90° clockwise (+90) or counter-clockwise (-90); the plan data is unchanged. */
  const rotateView = (step: 90 | -90) => mutate((l) => ({ ...l, viewRotation: rotateBy(l.viewRotation, step) }));

  return {
    addRow, addAisle, addCrossAisle, addTray, addFloating, moveFloatingTray, addFacility, updateElement, updateElements, duplicate, removeElement, removeElements, reorder, setSequence, moveTray, moveFacility,
    assign, assignTiles, unassign, unassignAll, moveRacks, changeDesign, relabel, setServes, setRoom, setWhitespace, rename, setFacilityLinks, rotateView, addDoor: addDoorTo, moveDoor, setCrossCables,
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
