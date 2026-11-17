import { describe, expect, it } from 'vitest';
import { LAYOUT_VIEW_ITEMS } from '../../features/layout/layout-view';

describe('DC Layout View menu', () => {
  it('offers trays, floating trays, row labels and cables', () => {
    expect(LAYOUT_VIEW_ITEMS.map((i) => i.id)).toEqual(['trays', 'floating-trays', 'row-labels', 'cables']);
  });
});
