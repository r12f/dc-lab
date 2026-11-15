import { describe, expect, it } from 'vitest';
import { newAisle, newFacility, newLayout, newRow, newTray } from '../layout/factory';
import { addAisleAfter, addFacilityNear, addRowAfter, addTrayOver, insertAnchor } from '../layout/insert';
import type { DcLayout } from '../layout/types';

function sample(): DcLayout {
  return {
    ...newLayout('l', 'L'),
    rows: [newRow('r1', 'Row 1'), newRow('r2', 'Row 2')],
    aisles: [newAisle('a1'), newAisle('a2')],
    sequence: ['r1', 'a1', 'r2', 'a2'],
    trays: [newTray('t1', 'a1')],
    facilities: [{ ...newFacility('pdu', 'pdu', 1000, 500) }],
    assignments: [{ id: 'x', rowId: 'r2', startTile: 0, designId: 'd', label: 'Row2-01' }],
  };
}

describe('add after the selection', () => {
  it('no selection: rows/aisles at the east end', () => {
    const l = sample();
    expect(addRowAfter(l, insertAnchor(l, undefined).after).layout.sequence.at(-1)).toMatch(/^row/);
  });
  it('a selected row: new row/aisle right after it', () => {
    const l = sample();
    const a = insertAnchor(l, { kind: 'row', ids: ['r1'] });
    const r = addRowAfter(l, a.after);
    expect(r.layout.sequence).toEqual(['r1', r.id, 'a1', 'r2', 'a2']);
    expect(r.layout.rows.find((x) => x.id === r.id)?.name).toBe('Row 3');
    const s = addAisleAfter(l, a.after);
    expect(s.layout.sequence).toEqual(['r1', s.id, 'a1', 'r2', 'a2']);
  });
  it('several selected: after the easternmost', () => {
    const l = sample();
    expect(insertAnchor(l, { kind: 'aisle', ids: ['a2', 'a1'] }).after).toBe('a2');
  });
  it('a tile or rack: after its row', () => {
    const l = sample();
    expect(insertAnchor(l, { kind: 'tile', tiles: [{ rowId: 'r1', tile: 3 }] }).after).toBe('r1');
    expect(insertAnchor(l, { kind: 'assignment', ids: ['x'] }).after).toBe('r2');
  });
  it('trays: over the selected row / aisle, else the next aisle east of a selected tray', () => {
    const l = sample();
    expect(addTrayOver(l, insertAnchor(l, { kind: 'aisle', ids: ['a2'] }).overId).layout.trays.at(-1)?.overId).toBe('a2');
    // A row: over its racks.
    expect(insertAnchor(l, { kind: 'row', ids: ['r2'] }).overId).toBe('r2');
    expect(insertAnchor(l, { kind: 'tray', ids: ['t1'] }).overId).toBe('a2');
    // No selection: the first aisle without a tray.
    expect(addTrayOver(l).layout.trays.at(-1)?.overId).toBe('a2');
  });
  it('facilities: next to the selected one', () => {
    const l = sample();
    const r = addFacilityNear(l, 'cooling', insertAnchor(l, { kind: 'facility', ids: ['pdu'] }).facilityId);
    const f = r.layout.facilities.find((x) => x.id === r.id)!;
    expect(f.y).toBe(500);
    expect(f.x).toBe(1000 + 1200 + 200);
  });
});
