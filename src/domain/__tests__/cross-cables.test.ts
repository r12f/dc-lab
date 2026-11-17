import { describe, expect, it } from 'vitest';
import { computeFloorPlan } from '../layout/floor-plan';
import { cableFibers, clipStart, crossRackLayout, crossRoute, traceBundles } from '../layout/cross-cables';
import { Library } from '../library/library';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import type { RackDesign } from '../design/types';
import { emptyProject } from '../project/types';
import type { DcLayout } from '../layout/types';

// Two rows with a hot aisle between them, an aisle tray over it and a floating tray across both rows.
const layout: DcLayout = {
  id: 'l', name: 'L', room: { widthMm: 20000, depthMm: 20000 }, whitespace: { x: 1000, y: 1000, widthMm: 18000, depthMm: 18000 },
  facilities: [], doors: [], assignments: [],
  rows: [
    { id: 'r1', name: 'R1', tileCount: 10, tileWidthMm: 600, tileDepthMm: 1200, powerBudgetKw: 0, frontFacing: 'west' },
    { id: 'r2', name: 'R2', tileCount: 10, tileWidthMm: 600, tileDepthMm: 1200, powerBudgetKw: 0, frontFacing: 'east' },
  ],
  aisles: [{ id: 'h', kind: 'hot', widthMm: 1200 }],
  sequence: ['r1', 'h', 'r2'],
  trays: [
    { id: 't1', kind: 'data', widthMm: 300, overId: 'h' },
    { id: 't2', kind: 'data', widthMm: 300, floating: true, fromId: 'r1', toId: 'r2', y: 4000 },
    { id: 'p', kind: 'power', widthMm: 300, overId: 'h', offsetMm: 400 },
  ],
};

describe('cross-rack routing', () => {
  const plan = computeFloorPlan(layout);
  it('enters the nearest tray, follows it and leaves at the point nearest the far rack', () => {
    const a = { x: 1600, y: 1300 };
    const b = { x: 4000, y: 6700 };
    const pts = crossRoute(layout, plan, a, b);
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
    // every segment is horizontal or vertical
    for (let i = 1; i < pts.length; i++) expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    // runs along the aisle tray centre (x = 2800)
    expect(pts.some((p) => p.x === 2800)).toBe(true);
  });
  it('enters the aisle tray beside the row, even when a floating tray runs over the rack', () => {
    // Rack in row 1 right under the floating tray (y 4150): still enters the aisle tray (x 2800) at its own height.
    const pts = crossRoute(layout, plan, { x: 1600, y: 4150 }, { x: 4000, y: 9700 });
    expect(pts[1]).toEqual({ x: 2800, y: 4150 });
    expect(pts.every((p) => p.y === 4150 || p.x === 2800 || p.y === 9700)).toBe(true);
  });
  it('switches trays at their crossing', () => {
    // Only the floating tray at one end: floating tray -> crossing -> aisle tray.
    const only = { ...layout, trays: layout.trays.filter((t) => t.id !== 't1') };
    const pts = crossRoute({ ...only, trays: [...only.trays, { id: 'tb', kind: 'data' as const, widthMm: 300, overId: 'h' }] }, plan, { x: 1600, y: 4150 }, { x: 4000, y: 9700 });
    expect(pts).toContainEqual({ x: 2800, y: 4150 });
  });
  it('falls back to a straight line without trays', () => {
    const pts = crossRoute({ ...layout, trays: [] }, plan, { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  });
  it('counts fibers from the cable', () => {
    expect(cableFibers({ fiberCount: 160 } as never)).toBe(160);
    expect(cableFibers({ ends: { a: { count: 2, connector: 'MPO-8', fibers: 8 } } } as never)).toBe(16);
  });
  it('lays out a housing rear like its faceplate: all modules, right to left', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const design: RackDesign = {
      id: 'd', name: 'D', abbr: 'D', templateId: lib.racks.items()[0].id, cables: [],
      placements: [{ id: 'fh', deviceId: 'fiber-housing-80xmmc16', label: 'FH1', mount: { kind: 'rack', position: 1, face: 'front' }, portSettings: {}, groupSettings: {} }],
      crossRack: [{ placementId: 'fh', portRef: 'rm2/1', connector: 1 }],
    };
    const [dev] = crossRackLayout(lib, design);
    expect(dev.faces.map((f) => f.face)).toEqual(['rear']);
    expect(dev.faces[0].groups.map((g) => [g.group.id, g.ports.size])).toEqual([['rm4', 0], ['rm3', 0], ['rm2', 1], ['rm1', 0]]);
  });
  it('starts a trace at the rack edge, not its centre', () => {
    const box = { x: 0, y: 0, widthMm: 1200, depthMm: 600 };
    expect(clipStart([{ x: 600, y: 300 }, { x: 2000, y: 300 }, { x: 2000, y: 5000 }], box))
      .toEqual([{ x: 1200, y: 300 }, { x: 2000, y: 300 }, { x: 2000, y: 5000 }]);
  });
  it('counts traces on shared runs', () => {
    const b = traceBundles([
      { key: 'p', points: [{ x: 0, y: 0 }, { x: 0, y: 1000 }, { x: 500, y: 1000 }] },
      { key: 'q', points: [{ x: 0, y: 400 }, { x: 0, y: 1000 }] },
      { key: 'r', points: [{ x: 0, y: 600 }, { x: 0, y: 2000 }] },
    ]);
    expect(b.map((x) => [x.a.y, x.b.y, x.keys.join('')])).toEqual([[400, 600, 'pq'], [600, 1000, 'pqr']]);
  });
  it('a trace from a rack in a row starts at the midpoint of the rack edge facing the tray', () => {
    const box = { x: 7800, y: 3600, widthMm: 1200, depthMm: 600 };
    const pts = clipStart([{ x: 8400, y: 3900 }, { x: 9600, y: 3900 }, { x: 9600, y: 9000 }], box);
    expect(pts[0]).toEqual({ x: 9000, y: 3900 });
  });
});
