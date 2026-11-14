/** Layout elements that can be selected (several at once), duplicated and dragged. */
export type ElementKind = 'row' | 'aisle' | 'tray' | 'facility';

/** What is selected on the layout canvas. Elements of one kind can be multi-selected. */
export type LayoutSelection =
  | { kind: 'tile'; rowId: string; tile: number }
  | { kind: 'assignment'; id: string }
  | { kind: ElementKind; ids: string[] };

export type ElementSelection = Extract<LayoutSelection, { ids: string[] }>;

export type DragKind = ElementKind;

export const ELEMENT_KINDS: ElementKind[] = ['row', 'aisle', 'tray', 'facility'];

export function isElementSelection(s: LayoutSelection | undefined): s is ElementSelection {
  return !!s && 'ids' in s;
}

export function isSelected(s: LayoutSelection | undefined, kind: ElementKind, id: string): boolean {
  return isElementSelection(s) && s.kind === kind && s.ids.includes(id);
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
