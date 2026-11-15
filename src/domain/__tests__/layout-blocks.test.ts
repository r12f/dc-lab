import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newAisle, newCrossAisle, newFloatingTray, newLayout, newRow, newTray } from '../layout/factory';
import { addFloatingTray, insertAnchor } from '../layout/insert';
import { computeFloorPlan, floorWarnings, nearestBand, reorderTo, ROW_HEADER_MM, trayRect } from '../layout/floor-plan';
import { changeDesigns, moveAssignments } from '../layout/move';
import { rowHotAisle } from '../layout/facility-load';
import { normalizeProject } from '../project/serializer';
import type { DcLayout } from '../layout/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const net = newDesign('n', 'Net', 'network-42ru-600');
const designs = (id: string) => (id === 'n' ? net : undefined);

/** Block 1: r1 a1 r2 | cross x1 | block 2: r3 a2 r4. Rows 10 x 600 mm = 6 m. */
function sample(): DcLayout {
  const row = (id: string, name: string) => ({ ...newRow(id, name), tileCount: 10 });
  return {
    ...newLayout('l', 'L'),
    room: { widthMm: 20000, depthMm: 18000 },
    whitespace: { x: 3000, y: 2000, widthMm: 14000, depthMm: 14000 },
    rows: [row('r1', 'Row 1'), row('r2', 'Row 2'), row('r3', 'Row 3'), row('r4', 'Row 4')],
    aisles: [newAisle('a1'), { ...newAisle('a2'), kind: 'hot' }, newCrossAisle('x1')],
    sequence: ['r1', 'a1', 'r2', 'x1', 'r3', 'a2', 'r4'],
    trays: [newTray('t1', 'x1'), { ...newTray('t2', 'a2'), offsetMm: 200 }, newFloatingTray('f1', 'r1', 'r2', 4000)],
    assignments: [
      { id: 'k1', rowId: 'r1', startTile: 0, designId: 'n', label: 'Row1-01' },
      { id: 'k2', rowId: 'r1', startTile: 1, designId: 'n', label: 'Spare' },
      { id: 'k3', rowId: 'r2', startTile: 1, designId: 'n', label: 'Row2-02' },
    ],
  };
}

describe('row blocks (rows of rows) split by cross aisles', () => {
  it('blocks stack north to south; the cross aisle spans the rack area between them', () => {
    const l = sample();
    const p = computeFloorPlan(l);
    const ws = l.whitespace;
    // Block 2 starts below the cross aisle plus room for its row headers; the last block fills the rack area.
    const y2 = ws.y + 6000 + 1800 + ROW_HEADER_MM;
    expect(p.blocks).toEqual([{ y: ws.y, depthMm: 6000 }, { y: y2, depthMm: Math.max(6000, ws.y + ws.depthMm - y2) }]);
    expect(p.rects.get('x1')).toEqual({ x: ws.x, y: ws.y + 6000, widthMm: ws.widthMm, depthMm: 1800 });
    expect(p.rects.get('r3')).toMatchObject({ x: ws.x, y: y2 });
    expect(p.rects.get('a1')!.depthMm).toBe(6000);
    // A cross aisle is not a row's rear (hot) aisle.
    expect(rowHotAisle(l, 'r4')).toBeUndefined();
    expect(rowHotAisle({ ...l, rows: l.rows.map((r) => (r.id === 'r4' ? { ...r, frontFacing: 'east' } : r)) }, 'r4')).toBe('a2');
  });
  it('dragging a row into the other block moves it there in the sequence', () => {
    const l = sample();
    const p = computeFloorPlan(l);
    const r3 = p.rects.get('r3')!;
    expect(reorderTo(l, 'r1', r3.x + r3.widthMm + 100, r3.y + 1000)).toEqual(['a1', 'r2', 'x1', 'r3', 'r1', 'a2', 'r4']);
    expect(reorderTo(l, 'r4', l.whitespace.x - 10, p.blocks[0].y + 10)).toEqual(['r4', 'r1', 'a1', 'r2', 'x1', 'r3', 'a2']);
    expect(reorderTo(l, 'x1', 0, 0)).toEqual(l.sequence);
  });
  it('blocks deeper than the rack area are a warning', () => {
    const l = { ...sample(), whitespace: { ...sample().whitespace, depthMm: 9000 } };
    expect(floorWarnings(l)).toContain(`Row blocks and cross aisles need ${13800 + ROW_HEADER_MM} mm; rack area is 9000 mm deep`);
  });
});

describe('floating trays', () => {
  it('aisle trays run along an aisle / cross aisle, centred, with an offset; drops land on aisles only', () => {
    const l = sample();
    const p = computeFloorPlan(l);
    const x = p.rects.get('x1')!;
    expect(trayRect(p, l.trays[0])).toEqual({ x: x.x, y: x.y + 600, widthMm: x.widthMm, depthMm: 600 });
    const a2 = p.rects.get('a2')!;
    expect(trayRect(p, l.trays[1])).toEqual({ x: a2.x + 300 + 200, y: a2.y, widthMm: 600, depthMm: a2.depthMm });
    const r3 = p.rects.get('r3')!;
    expect(nearestBand(p, r3.x + 10, r3.y + 10)).not.toBe('r3');
  });
  it('a floating tray runs across the rows (east–west) from one band to another, at its own y', () => {
    const l = sample();
    const p = computeFloorPlan(l);
    const r1 = p.rects.get('r1')!;
    const r2 = p.rects.get('r2')!;
    expect(trayRect(p, l.trays[2])).toEqual({ x: r1.x, y: 4000, widthMm: r2.x + r2.widthMm - r1.x, depthMm: 300 });
    // Added across the selected rows (westmost..eastmost), at the selected tile.
    const r = addFloatingTray(l, insertAnchor(l, { kind: 'tile', tiles: [{ rowId: 'r4', tile: 2 }, { rowId: 'r3', tile: 2 }] }).rows, 9000);
    expect(r.layout.trays.at(-1)).toMatchObject({ floating: true, fromId: 'r3', toId: 'r4', y: 9000 });
    // Default: every band of the first row block.
    expect(addFloatingTray(l).layout.trays.at(-1)).toMatchObject({ fromId: 'r1', toId: 'r2' });
  });
  it('legacy trays over an aisle (`aisleId`) load as `overId`', () => {
    const p = normalizeProject({ layouts: [{ ...newLayout('l', 'L'), aisles: [newAisle('a')], sequence: ['a'], trays: [{ id: 't', kind: 'data', aisleId: 'a', widthMm: 600 }] }] });
    expect(p.layouts[0].trays[0]).toEqual({ id: 't', kind: 'data', overId: 'a', widthMm: 600 });
  });
});

describe('moving several racks', () => {
  it('moves together by rows (across blocks) and tiles; auto labels follow, hand labels stay', () => {
    const r = moveAssignments(lib, designs, sample(), ['k1', 'k2'], 2, 3);
    expect(r.error).toBeUndefined();
    expect(r.layout.assignments.map((a) => [a.id, a.rowId, a.startTile, a.label])).toEqual([
      ['k1', 'r3', 3, 'Row3-04'], ['k2', 'r3', 4, 'Spare'], ['k3', 'r2', 1, 'Row2-02']]);
  });
  it('all or none: one rack that does not fit stops the move', () => {
    const l = sample();
    expect(moveAssignments(lib, designs, l, ['k1', 'k2'], 1, 0)).toEqual({ layout: l, error: 'Spare: Overlaps Row2-02' });
    expect(moveAssignments(lib, designs, l, ['k1'], -1, 0).error).toBe('Row1-01: no row there');
    expect(moveAssignments(lib, designs, l, ['k2'], 0, 9).error).toMatch(/^Spare: Needs 1 tiles/);
    // Racks moving into each other's old spots is fine.
    expect(moveAssignments(lib, designs, l, ['k1', 'k2'], 0, 1).error).toBeUndefined();
  });
  it('changes the design of several racks in place', () => {
    const r = changeDesigns(lib, designs, sample(), ['k1', 'k3'], 'n');
    expect(r.changed).toBe(0);
  });
});
