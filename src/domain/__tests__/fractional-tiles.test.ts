import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { assignmentAt, assignmentProblem, startInTile, tilesUsed, tileWidthOf } from '../layout/tiles';
import type { DcLayout, Row } from '../layout/types';

// Fractional widths are a template feature; a 1.5-tile project template exercises it.
// 900 mm wide -> 1.5 tiles (computed from the width).
const wide15 = { ...BUILTIN_CATALOG_FOR_TESTS.racks.find((r) => r.id === 'orv3-44ou')!, id: 'rack-1-5', name: '1.5-tile rack', widthMm: 900 };
const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), racks: [wide15] });
const orv3 = newDesign('o', '1.5-tile', 'rack-1-5');
const net = newDesign('n', 'Net', 'network-42ru-600');
const designs = (id: string) => [orv3, net].find((d) => d.id === id);
const row = { id: 'r1', name: 'Row 1', tileCount: 6 } as Row;
const layoutWith = (assignments: DcLayout['assignments']) => ({ rows: [row], assignments } as unknown as DcLayout);

describe('fractional rack tile widths', () => {
  it('ORv3 is 1 tile wide; a 1.5-tile template keeps its fractional width', () => {
    expect(tileWidthOf(lib, newDesign('x', 'ORv3', 'orv3-44ou'))).toBe(1);
    expect(tileWidthOf(lib, orv3)).toBe(1.5);
  });
  it('the next rack on a half-filled tile starts where the previous one ends', () => {
    const l = layoutWith([{ id: 'a', rowId: 'r1', startTile: 0, designId: 'o', label: 'A' }]);
    expect(startInTile(lib, designs, l, 'r1', 1)).toBe(1.5);
    expect(assignmentAt(lib, designs, l, 'r1', 1)).toBeUndefined();
    expect(assignmentAt(lib, designs, l, 'r1', 0)?.id).toBe('a');
    expect(assignmentProblem(lib, designs, l, row, 1.5, 'o')).toBeUndefined();
    expect(assignmentProblem(lib, designs, l, row, 1, 'o')).toBe('Overlaps A');
  });
  it('two 1.5-tile racks fill 3 tiles; used tiles sum widths; end of row is checked', () => {
    const a = [{ id: 'a', rowId: 'r1', startTile: 0, designId: 'o', label: 'A' }, { id: 'b', rowId: 'r1', startTile: 1.5, designId: 'o', label: 'B' }];
    const l = layoutWith(a);
    expect(tilesUsed(lib, designs, a)).toBe(3);
    expect(assignmentAt(lib, designs, l, 'r1', 2)?.id).toBe('b');
    expect(startInTile(lib, designs, l, 'r1', 3)).toBe(3);
    expect(assignmentProblem(lib, designs, l, row, 4.5, 'o')).toBeUndefined();
    expect(assignmentProblem(lib, designs, l, row, 5, 'o')).toMatch(/Needs 1.5 tiles; row has 1/);
  });
});
