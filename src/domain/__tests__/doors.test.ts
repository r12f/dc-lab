import { describe, expect, it } from 'vitest';
import { newLayout } from '../layout/factory';
import { addDoor, clampDoor, doorSegment, nearestWallSpot } from '../layout/doors';
import { duplicateElements } from '../layout/duplicate';
import { normalizeProject } from '../project/serializer';

const l = newLayout('l', 'L'); // 20 x 16 m

describe('doors', () => {
  it('first door is the entry, centred on the south wall', () => {
    const r = addDoor(l);
    expect(r.layout.doors[0]).toMatchObject({ name: 'Entry', kind: 'entry', wall: 'south', widthMm: 1200, offsetMm: 9400 });
    expect(doorSegment(r.layout, r.layout.doors[0])).toMatchObject({ x1: 9400, y1: 16000, x2: 10600, y2: 16000, ny: -1 });
  });
  it('a second door goes next to the selected one on the same wall', () => {
    const a = addDoor(l);
    const b = addDoor(a.layout, a.id);
    expect(b.layout.doors[1]).toMatchObject({ wall: 'south', offsetMm: 9400 + 1200 + 1000, kind: 'exit' });
  });
  it('stays on its wall and snaps to the nearest wall when dragged', () => {
    const a = addDoor(l).layout;
    expect(clampDoor(a, { ...a.doors[0], offsetMm: 99999 }).offsetMm).toBe(20000 - 1200);
    expect(nearestWallSpot(a, 19900, 5000, 1200)).toEqual({ wall: 'east', offsetMm: 4400 });
    expect(nearestWallSpot(a, 3000, 100, 1200)).toEqual({ wall: 'north', offsetMm: 2400 });
  });
  it('can be duplicated; old layouts get no doors', () => {
    const a = addDoor(l);
    expect(duplicateElements(a.layout, 'door', [a.id]).layout.doors).toHaveLength(2);
    const p = normalizeProject({ layouts: [{ id: 'x', name: 'X', rows: [], aisles: [], sequence: [], trays: [], assignments: [], facilities: [], room: { widthMm: 1, depthMm: 1 }, whitespace: { x: 0, y: 0, widthMm: 1, depthMm: 1 } }] });
    expect(p.layouts[0].doors).toEqual([]);
  });
});
