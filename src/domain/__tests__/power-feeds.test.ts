import { describe, expect, it } from 'vitest';
import { newFacility, newLayout, newRow } from '../layout/factory';
import { facilityAllocatedKw, feedWarnings, pruneFeeds, rowSupplyKw, setFeed } from '../layout/power-feeds';
import { normalizeProject } from '../project/serializer';
import type { DcLayout } from '../layout/types';

function sample(): DcLayout {
  return {
    ...newLayout('l', 'L'),
    rows: [newRow('r1', 'Row 1'), newRow('r2', 'Row 2')],
    sequence: ['r1', 'r2'],
    facilities: [{ ...newFacility('p1', 'pdu', 0, 0), name: 'PDU-A', capacityKw: 500 }, { ...newFacility('p2', 'pdu', 0, 0), name: 'PDU-B', capacityKw: 500 }],
  };
}

describe('PDU -> row power feeds', () => {
  it('set, update and remove a feed (one per PDU-row pair)', () => {
    let l = setFeed(sample(), 'p1', 'r1', 200);
    l = setFeed(l, 'p2', 'r1', 150);
    l = setFeed(l, 'p1', 'r1', 250);
    expect(l.feeds).toHaveLength(2);
    expect(rowSupplyKw(l, 'r1')).toBe(400);
    expect(facilityAllocatedKw(l, 'p1')).toBe(250);
    expect(setFeed(l, 'p1', 'r1', 0).feeds).toHaveLength(1);
  });
  it('warns when a PDU is over capacity or a fed row draws more than it gets', () => {
    let l = setFeed(sample(), 'p1', 'r1', 300);
    l = setFeed(l, 'p1', 'r2', 300);
    const w = feedWarnings(l, new Map([['r1', 350_000], ['r2', 100_000]]));
    expect(w).toEqual(['PDU-A: feeds 600 kW but capacity is 500 kW', 'Row 1: draws 350.0 kW but is fed 300 kW']);
  });
  it('rows without feeds are not checked; deleting a row or PDU drops its feeds', () => {
    const l = setFeed(sample(), 'p1', 'r1', 100);
    expect(feedWarnings(l, new Map([['r2', 999_000]]))).toEqual([]);
    expect(pruneFeeds({ ...l, rows: l.rows.filter((r) => r.id !== 'r1') }).feeds).toEqual([]);
  });
  it('old layouts get an empty feed list', () => {
    const p = normalizeProject({ layouts: [{ id: 'l', name: 'L', rows: [], aisles: [], sequence: [], trays: [], assignments: [], facilities: [], room: { widthMm: 1, depthMm: 1 }, whitespace: { x: 0, y: 0, widthMm: 1, depthMm: 1 } }] });
    expect(p.layouts[0].feeds).toEqual([]);
  });
});
