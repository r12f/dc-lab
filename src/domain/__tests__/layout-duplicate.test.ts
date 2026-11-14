import { describe, expect, it } from 'vitest';
import { newAisle, newLayout, newRow, newTray } from '../layout/factory';
import { duplicateElements } from '../layout/duplicate';
import type { DcLayout } from '../layout/types';

function sample(): DcLayout {
  return {
    ...newLayout('l', 'L'),
    rows: [newRow('r1', 'Row 1')],
    aisles: [newAisle('a1'), newAisle('a2')],
    sequence: ['a1', 'r1', 'a2'],
    trays: [newTray('t1', 'a1')],
    assignments: [{ id: 'r', rowId: 'r1', startTile: 2, designId: 'd', label: 'Row1-03' }],
  };
}

describe('duplicate layout elements', () => {
  it('row copy goes at the east end, with its racks relabelled', () => {
    const { layout, ids } = duplicateElements(sample(), 'row', ['r1']);
    expect(layout.sequence).toEqual(['a1', 'r1', 'a2', ids[0]]);
    const copy = layout.rows.find((r) => r.id === ids[0])!;
    expect(copy.name).toBe('Row 2');
    expect(layout.assignments.filter((a) => a.rowId === copy.id)).toMatchObject([{ startTile: 2, label: 'Row2-03' }]);
    expect(new Set(layout.assignments.map((a) => a.id)).size).toBe(layout.assignments.length);
  });
  it('several aisles at once are appended at the east end in their west-to-east order', () => {
    const { layout, ids } = duplicateElements(sample(), 'aisle', ['a2', 'a1']);
    expect(ids).toHaveLength(2);
    expect(layout.sequence).toEqual(['a1', 'r1', 'a2', ids[0], ids[1]]);
    expect(layout.aisles.find((a) => a.id === ids[0])).toMatchObject({ kind: layout.aisles.find((a) => a.id === 'a1')!.kind });
  });
  it('tray copy moves to the next aisle without a tray of its kind', () => {
    const { layout, ids } = duplicateElements(sample(), 'tray', ['t1']);
    expect(layout.trays.find((t) => t.id === ids[0])!.aisleId).toBe('a2');
  });
});
