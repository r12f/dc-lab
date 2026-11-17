import type { CheckMenuItem } from '../../ui/check-menu';

/** Layers of the DC Layout canvas that the View menu can hide (drawing only). */
export type LayoutViewItem = 'trays' | 'floating-trays' | 'row-labels' | 'cables';

export const LAYOUT_VIEW_ITEMS: (CheckMenuItem & { id: LayoutViewItem })[] = [
  { id: 'trays', label: 'Trays' },
  { id: 'floating-trays', label: 'Floating trays' },
  { id: 'row-labels', label: 'Row labels' },
  { id: 'cables', label: 'Cables' },
];
