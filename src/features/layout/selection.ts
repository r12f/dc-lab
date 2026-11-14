/** What is selected on the layout canvas. */
export type LayoutSelection =
  | { kind: 'tile'; rowId: string; tile: number }
  | { kind: 'assignment'; id: string }
  | { kind: 'row'; id: string }
  | { kind: 'aisle'; id: string }
  | { kind: 'tray'; id: string };
