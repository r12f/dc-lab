import type { TileRef } from '../../domain/layout/assign';

/** Layout elements that can be selected (several at once), duplicated and dragged. */
export type ElementKind = 'row' | 'aisle' | 'tray' | 'facility' | 'door';

/** What is selected on the layout canvas. Elements of one kind can be multi-selected, and so can tiles. */
export type LayoutSelection =
  | TileSelection
  | { kind: 'assignment'; id: string }
  | { kind: ElementKind; ids: string[] };

/** One or more floor tiles (any rows); the last one clicked is the anchor for Shift-click runs. */
export type TileSelection = { kind: 'tile'; tiles: TileRef[] };

export type ElementSelection = Extract<LayoutSelection, { ids: string[] }>;

export type DragKind = ElementKind;

export const ELEMENT_KINDS: ElementKind[] = ['row', 'aisle', 'tray', 'facility', 'door'];

export function isElementSelection(s: LayoutSelection | undefined): s is ElementSelection {
  return !!s && 'ids' in s;
}

export function isSelected(s: LayoutSelection | undefined, kind: ElementKind, id: string): boolean {
  return isElementSelection(s) && s.kind === kind && s.ids.includes(id);
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
 * Click on an element: plain click selects only it; Ctrl/Shift-click adds or removes it (same kind,
 * else starts a new selection).
 */
export function clickSelect(s: LayoutSelection | undefined, kind: ElementKind, id: string, additive: boolean): LayoutSelection | undefined {
  if (!additive || !isElementSelection(s) || s.kind !== kind) return { kind, ids: [id] };
  const ids = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id];
  return ids.length ? { kind, ids } : undefined;
}
