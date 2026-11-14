import type { Library } from '../../domain/library/Library';
import type { Aisle, CableTray, DcLayout, Row } from '../../domain/layout/types';
import { newAisle, newRow, newTray } from '../../domain/layout/factory';
import { assignmentProblem, type DesignLookup } from '../../domain/layout/tiles';
import { clampToRoom, eastEdge, movableRect, snap, type MovableKind } from '../../domain/layout/geometry';
import { uniqueId } from '../../domain/ids';
import { useAppStore } from '../../state/store';

type ListName = 'rows' | 'aisles' | 'trays';
type Element = Row | Aisle | CableTray;

const LIST: Record<MovableKind, ListName> = { row: 'rows', aisle: 'aisles', tray: 'trays' };

/** Commands on one DC layout. */
export function useLayoutEditor(lib: Library, designs: DesignLookup, layout: DcLayout | undefined) {
  const update = useAppStore((s) => s.update);
  const mutate = (fn: (l: DcLayout) => DcLayout) => layout && update('layouts', layout.id, fn);

  // New elements go east of everything, so row/aisle/row builds an aisle sequence.
  const addRow = () => mutate((l) => {
    const id = uniqueId('row', l.rows.map((r) => r.id));
    return { ...l, rows: [...l.rows, newRow(id, `Row ${l.rows.length + 1}`, eastEdge(l))] };
  });
  const addAisle = () => mutate((l) => ({ ...l, aisles: [...l.aisles, newAisle(uniqueId('aisle', l.aisles.map((a) => a.id)), eastEdge(l))] }));
  const addTray = () => mutate((l) => ({ ...l, trays: [...l.trays, newTray(uniqueId('tray', l.trays.map((a) => a.id)), eastEdge(l))] }));

  function updateElement<T extends Element>(list: ListName, id: string, patch: Partial<T>) {
    mutate((l) => ({ ...l, [list]: (l[list] as Element[]).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  const removeElement = (list: ListName, id: string) =>
    mutate((l) => ({
      ...l,
      [list]: (l[list] as Element[]).filter((e) => e.id !== id),
      assignments: list === 'rows' ? l.assignments.filter((a) => a.rowId !== id) : l.assignments,
    }));

  /** Moves a row/aisle/tray so its top-left is at (x, y), snapped and kept inside the room. */
  const moveElement = (kind: MovableKind, id: string, x: number, y: number) =>
    mutate((l) => {
      const r = movableRect(l, kind, id);
      if (!r) return l;
      const pos = clampToRoom(l, snap(x), snap(y), r.widthMm, r.depthMm);
      const list = LIST[kind];
      return { ...l, [list]: (l[list] as Element[]).map((e) => (e.id === id ? { ...e, ...pos } : e)) };
    });

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
  const rename = (name: string) => mutate((l) => ({ ...l, name }));

  return { addRow, addAisle, addTray, updateElement, removeElement, moveElement, assign, unassign, relabel, setRoom, rename };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
