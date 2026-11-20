import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { duplicateRacks } from '../layout/assign';
import type { DcLayout, Row } from '../layout/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const net = newDesign('n', 'Net', 'network-42ru-600');
const designs = (id: string) => (id === 'n' ? net : undefined);
const row = { id: 'r1', name: 'Row 1', tileCount: 4 } as Row;
const layout = {
  rows: [row],
  assignments: [
    { id: 'a', rowId: 'r1', startTile: 0, designId: 'n', label: 'Row1-01' },
    { id: 'b', rowId: 'r1', startTile: 1, designId: 'n', label: 'Row1-02' },
  ],
} as unknown as DcLayout;

describe('DC layout: duplicate racks', () => {
  it('copies each rack to the next free tile after it in its row; no room = skipped', () => {
    const r = duplicateRacks(lib, designs, layout, ['a']);
    expect(r.layout.assignments.find((x) => x.id === r.ids[0])).toMatchObject({ startTile: 2, designId: 'n', label: 'Row1-03' });
    const full = duplicateRacks(lib, designs, r.layout, ['a', 'b', r.ids[0]]);
    expect(full.ids).toHaveLength(1);
    expect(full.skipped).toHaveLength(2);
  });
});
