import type { TileRef } from '../../domain/layout/assign';

/** Layout elements that can be selected (several at once), duplicated and dragged. */
export type ElementKind = 'row' | 'aisle' | 'tray' | 'facility' | 'door';

/** What is selected on the layout canvas. Elements of one kind, tiles and racks can each be multi-selected. */
export type LayoutSelection =
  | TileSelection
  | RackSelection
  | { kind: ElementKind; ids: string[] };

/** One or more floor tiles (any rows); the last one clicked is the anchor for Shift-click runs. */
export type TileSelection = { kind: 'tile'; tiles: TileRef[] };

/** One or more assigned racks (any rows). */
export type RackSelection = { kind: 'assignment'; ids: string[] };

export type ElementSelection = Extract<LayoutSelection, { kind: ElementKind }>;

export type DragKind = ElementKind | 'assignment';

export const ELEMENT_KINDS: ElementKind[] = ['row', 'aisle', 'tray', 'facility', 'door'];

export function isElementSelection(s: LayoutSelection | undefined): s is ElementSelection {
  return !!s && (ELEMENT_KINDS as string[]).includes(s.kind);
}

export function isSelected(s: LayoutSelection | undefined, kind: ElementKind | 'assignment', id: string): boolean {
  return !!s && s.kind === kind && 'ids' in s && s.ids.includes(id);
}

export function isTileSelected(s: LayoutSelection | undefined, rowId: string, tile: number): boolean {
  return s?.kind === 'tile' && s.tiles.some((t) => t.rowId === rowId && t.tile === tile);
}

/**
 * Click on a tile: plain click selects only it; Ctrl-click adds or removes it; Shift-click adds the run from the
 * last selected tile in the same row (else just the tile).
 */
export function clickTile(s: LayoutSelection | undefined, rowId: string, tile: number, mod: { toggle: boolean; range: boolean }): LayoutSelection | undefined {
  const cur = s?.kind === 'tile' ? s.tiles : [];
  const has = (r: string, t: number) => cur.some((x) => x.rowId === r && x.tile === t);
  if (mod.range && cur.length) {
    const anchor = cur[cur.length - 1];
    if (anchor.rowId === rowId) {
      const [a, b] = anchor.tile <= tile ? [anchor.tile, tile] : [tile, anchor.tile];
      const run = Array.from({ length: b - a + 1 }, (_, i) => ({ rowId, tile: a + i })).filter((x) => !has(x.rowId, x.tile));
      // Keep the clicked tile last so the next Shift-click extends from it.
      const ordered = [...run.filter((x) => x.tile !== tile), ...run.filter((x) => x.tile === tile)];
      return { kind: 'tile', tiles: [...cur, ...ordered] };
    }
  }
  if (mod.toggle || mod.range) {
    const tiles = has(rowId, tile) ? cur.filter((x) => !(x.rowId === rowId && x.tile === tile)) : [...cur, { rowId, tile }];
    return tiles.length ? { kind: 'tile', tiles } : undefined;
  }
  return { kind: 'tile', tiles: [{ rowId, tile }] };
}

/**
 * Click on an element or rack: plain click selects only it; Ctrl/Shift-click adds or removes it (same kind,
 * else starts a new selection).
 */
export function clickSelect(s: LayoutSelection | undefined, kind: ElementKind | 'assignment', id: string, additive: boolean): LayoutSelection | undefined {
  if (!additive || !s || s.kind !== kind || !('ids' in s)) return { kind, ids: [id] } as LayoutSelection;
  const ids = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id];
  return ids.length ? ({ kind, ids } as LayoutSelection) : undefined;
}
