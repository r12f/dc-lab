import { describe, expect, it } from 'vitest';
import { newAisle, newLayout, newRow, newTray } from '../layout/factory';
import { computeFloorPlan, floorWarnings, nearestAisle, reorderTo, tileRect, trayRect } from '../layout/floor-plan';
import { clampToRoom, snap } from '../layout/geometry';
import { normalizeProject } from '../project/serializer';
import type { DcLayout } from '../layout/types';

function sample(): DcLayout {
  return {
    ...newLayout('l', 'L'),
    rows: [newRow('r1', 'Row 1'), newRow('r2', 'Row 2')],
    aisles: [newAisle('a1'), { ...newAisle('a2'), kind: 'hot' }],
    sequence: ['a1', 'r1', 'a2', 'r2'],
    trays: [newTray('t1', 'a2')],
  };
}

describe('floor plan', () => {
  it('packs the sequence west to east inside the rack area', () => {
    const l = sample();
    const plan = computeFloorPlan(l);
    expect(plan.bands.map((b) => [b.id, b.rect.x])).toEqual([['a1', 3000], ['r1', 4200], ['a2', 5400], ['r2', 6600]]);
    expect(plan.rects.get('r1')).toEqual({ x: 4200, y: 2000, widthMm: 1200, depthMm: 12000 });
    expect(plan.rects.get('a1')!.depthMm).toBe(l.whitespace.depthMm);
    expect(tileRect(plan.rects.get('r1')!, l.rows[0], 2, 2)).toEqual({ x: 4200, y: 3200, widthMm: 1200, depthMm: 1200 });
  });
  it('trays float centred over their aisle', () => {
    const l = sample();
    expect(trayRect(computeFloorPlan(l), l.trays[0])).toEqual({ x: 5700, y: 2000, widthMm: 600, depthMm: 12000 });
  });
  it('dragging reorders by centre position', () => {
    const l = sample();
    expect(reorderTo(l, 'r2', 3100)).toEqual(['r2', 'a1', 'r1', 'a2']);
    expect(reorderTo(l, 'a1', 99999)).toEqual(['r1', 'a2', 'r2', 'a1']);
    expect(nearestAisle(computeFloorPlan(l), 3500)).toBe('a1');
  });
  it('warns on overflow and facilities in the rack area', () => {
    const l = { ...sample(), whitespace: { x: 3000, y: 2000, widthMm: 4000, depthMm: 10000 },
      facilities: [{ id: 'f', kind: 'pdu' as const, name: 'PDU-A', x: 3500, y: 2500, widthMm: 1000, depthMm: 800 }] };
    expect(floorWarnings(l)).toEqual([
      'Rows and aisles need 4800 mm; rack area is 4000 mm wide',
      'Row 1 is 12000 mm long; rack area is 10000 mm deep',
      'Row 2 is 12000 mm long; rack area is 10000 mm deep',
      'PDU-A overlaps the rack area',
    ]);
  });
  it('snap and clamp', () => {
    expect(snap(1234)).toBe(1200);
    expect(clampToRoom(newLayout('l', 'L'), -500, 99999, 1200, 800)).toEqual({ x: 0, y: 16000 - 800 });
  });
});

describe('layout migration', () => {
  it('free positions -> rack area + sequence, trays attach to nearest aisle', () => {
    const p = normalizeProject({
      layouts: [{ id: 'l', room: { widthMm: 20000, depthMm: 16000 },
        rows: [{ id: 'r2', x: 4800, y: 1200, tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200, frontFacing: 'west' },
          { id: 'r1', x: 1200, y: 1200, tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200, frontFacing: 'east' }],
        aisles: [{ id: 'a', kind: 'cold', x: 2400, y: 1200, widthMm: 1200, depthMm: 12000 }],
        trays: [{ id: 't', kind: 'data', x: 2600, y: 1200, widthMm: 300, depthMm: 12000 }], assignments: [] }],
    });
    const l = p.layouts[0];
    expect(l.sequence).toEqual(['r1', 'a', 'r2']);
    expect(l.whitespace).toEqual({ x: 1200, y: 1200, widthMm: 4800, depthMm: 12000 });
    expect(l.trays[0]).toEqual({ id: 't', kind: 'data', overId: 'a', widthMm: 300 });
    expect(l.rows[0]).not.toHaveProperty('x');
    expect(l.facilities).toEqual([]);
  });
  it('rotates legacy horizontal layouts first', () => {
    const p = normalizeProject({
      layouts: [{ id: 'l', room: { widthMm: 20000, depthMm: 12000 },
        rows: [{ id: 'r', x: 1200, y: 3000, frontFacing: 'south', tileCount: 20, tileWidthMm: 600, tileDepthMm: 1200 }],
        aisles: [{ id: 'a', x: 1200, y: 1800, widthMm: 12000, depthMm: 1200 }], trays: [], assignments: [] }],
    });
    const l = p.layouts[0];
    expect(l.room).toEqual({ widthMm: 12000, depthMm: 20000 });
    expect(l.sequence).toEqual(['a', 'r']);
    expect(l.rows[0].frontFacing).toBe('east');
  });
});
