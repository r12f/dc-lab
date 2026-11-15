import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { assignTiles } from '../layout/assign';
import type { DcLayout, Row } from '../layout/types';
import { clickTile } from '../../features/layout/selection';
import { fitZoom } from '../../ui/canvas-frame';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const net = newDesign('n', 'Net', 'network-42ru-600');
const designs = (id: string) => (id === 'n' ? net : undefined);
const row = { id: 'r1', name: 'Row 1', tileCount: 4 } as Row;
const layout = { rows: [row], assignments: [{ id: 'x', rowId: 'r1', startTile: 1, designId: 'n', label: 'Row1-02' }] } as unknown as DcLayout;

describe('DC layout: multi-tile assign', () => {
  it('assigns one design to every free selected tile in order; taken tiles are skipped and reported', () => {
    const r = assignTiles(lib, designs, layout, [{ rowId: 'r1', tile: 3 }, { rowId: 'r1', tile: 0 }, { rowId: 'r1', tile: 1 }], 'n');
    expect(r.layout.assignments.filter((a) => a.id !== 'x').map((a) => [a.startTile, a.label])).toEqual([[0, 'Row1-01'], [3, 'Row1-04']]);
    expect(r.skipped).toEqual(['Row 1 tile 2: taken by Row1-02']);
  });
  it('tile selection: Ctrl toggles, Shift adds the run from the last tile in the row', () => {
    let s = clickTile(undefined, 'r1', 0, { toggle: false, range: false });
    s = clickTile(s, 'r1', 3, { toggle: false, range: true });
    expect(s?.kind === 'tile' && s.tiles.map((t) => t.tile).sort()).toEqual([0, 1, 2, 3]);
    s = clickTile(s, 'r1', 2, { toggle: true, range: false });
    expect(s?.kind === 'tile' && s.tiles.map((t) => t.tile).sort()).toEqual([0, 1, 3]);
    expect(clickTile(s, 'r1', 2, { toggle: false, range: false })).toEqual({ kind: 'tile', tiles: [{ rowId: 'r1', tile: 2 }] });
  });
});

describe('canvas fit zoom', () => {
  it('fits the drawing width, never above 100 %', () => {
    expect(fitZoom(1000, 4000)).toBe(0.25);
    expect(fitZoom(1000, 2000)).toBe(0.5);
    expect(fitZoom(1000, 500)).toBe(1);
  });
});
