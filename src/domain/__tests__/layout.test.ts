import { describe, expect, it } from 'vitest';
import { newLayout, newRow } from '../layout/factory';
import { clampToRoom, eastEdge, rowRect, snap, tileRect } from '../layout/geometry';
import { normalizeProject } from '../project/serializer';

describe('vertical rows', () => {
  const row = newRow('r', 'Row 1', 1200, 1000);
  it('tiles run north to south', () => {
    expect(rowRect(row)).toEqual({ x: 1200, y: 1000, widthMm: 1200, depthMm: 12000 });
    expect(tileRect(row, 2, 2)).toEqual({ x: 1200, y: 2200, widthMm: 1200, depthMm: 1200 });
  });
  it('new elements go east of everything', () => {
    const l = { ...newLayout('l', 'L'), rows: [row] };
    expect(eastEdge(l)).toBe(2400);
  });
  it('moves snap and stay in the room', () => {
    const l = newLayout('l', 'L');
    expect(snap(1234)).toBe(1200);
    expect(clampToRoom(l, -500, 99999, 1200, 12000)).toEqual({ x: 0, y: l.room.depthMm - 12000 });
  });
  it('rotates legacy horizontal layouts', () => {
    const p = normalizeProject({
      layouts: [{ id: 'l', room: { widthMm: 20000, depthMm: 12000 },
        rows: [{ id: 'r', x: 1200, y: 3000, frontFacing: 'south' }],
        aisles: [{ id: 'a', x: 1200, y: 1800, widthMm: 12000, depthMm: 1200 }], trays: [], assignments: [] }],
    });
    const l = p.layouts[0];
    expect(l.room).toEqual({ widthMm: 12000, depthMm: 20000 });
    expect(l.rows[0]).toMatchObject({ x: 3000, y: 1200, frontFacing: 'east' });
    expect(l.aisles[0]).toMatchObject({ x: 1800, y: 1200, widthMm: 1200, depthMm: 12000 });
  });
});
