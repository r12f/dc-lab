import { describe, expect, it } from 'vitest';
import { focusedRuns, routeCablingLines, type LegAnchor } from '../../features/designer/cabling-lines';
import type { CableRun } from '../design/types';

const key = (e: { placementId: string; portRef: string }) => `${e.placementId}|${e.portRef}`;
const anchor = (x: number, y: number, top: number, bottom: number, face: 'front' | 'rear' = 'front'): LegAnchor => ({ x, y, gapAbove: top, gapBelow: bottom, face });
const run = (id: string, from: string, to: string, route: 'left' | 'right'): CableRun => ({
  id, route, mediaId: 'm', quantity: 1,
  from: [{ placementId: from, portRef: 'p/1' }], to: [{ placementId: to, portRef: 'p/1' }],
});

describe('cabling view lines follow the run route', () => {
  const anchors = new Map([
    ['a|p/1', anchor(200, 20, 5, 40)],
    ['b|p/1', anchor(300, 100, 85, 120)],
    ['c|p/1', anchor(250, 200, 185, 220)],
  ]);
  const channel = { front: { left: 0, right: 500, width: 90 }, rear: { left: 600, right: 1100, width: 90 } };

  it('turns at the nearer device gap and runs in the chosen side channel', () => {
    const [l] = routeCablingLines([run('r', 'a', 'b', 'left')], anchors, key, channel, 0);
    expect(l.points[0]).toEqual([200, 20]);
    expect(l.points[1]).toEqual([200, 5]);
    expect(l.points[2][0]).toBeLessThan(90);
    expect(l.points.at(-1)).toEqual([300, 100]);
    const [r] = routeCablingLines([run('r', 'a', 'b', 'right')], anchors, key, channel, 0);
    expect(r.points[2][0]).toBeGreaterThan(500);
  });

  it('nests lanes on one side: the longer run lies outside the shorter', () => {
    const lines = routeCablingLines([run('long', 'a', 'c', 'left'), run('short', 'a', 'b', 'left')], anchors, key, channel, 0);
    const lane = (id: string) => lines.find((l) => l.runId === id)!.points[2][0];
    expect(lane('long')).toBeLessThan(lane('short'));
  });

  it('a breakout draws one line per B connector, all in the run lane', () => {
    const r: CableRun = { ...run('y', 'a', 'b', 'right'), to: [{ placementId: 'b', portRef: 'p/1' }, { placementId: 'c', portRef: 'p/1' }] };
    const lines = routeCablingLines([r], anchors, key, channel, 0);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((l) => l.points[2][0])).size).toBe(1);
  });
});

describe('cabling view: front and rear have their own channels', () => {
  const anchors = new Map([
    ['f|p/1', anchor(200, 20, 5, 40)],
    ['g|p/1', anchor(250, 100, 85, 120)],
    ['r|p/1', anchor(800, 100, 85, 120, 'rear')],
  ]);
  const channels = { front: { left: 0, right: 500, width: 90 }, rear: { left: 600, right: 1100, width: 90 } };
  it('a front-front run stays in the front block channel', () => {
    const [l] = routeCablingLines([run('x', 'f', 'g', 'right')], anchors, key, channels, 2);
    expect(l.points[2][0]).toBeGreaterThan(500);
    expect(l.points[2][0]).toBeLessThan(600);
  });
  it('a front-rear run uses each face its own channel on the route side, crossing at the top band', () => {
    const [l] = routeCablingLines([run('x', 'f', 'r', 'left')], anchors, key, channels, 2);
    const xs = l.points.map((p) => p[0]);
    expect(xs[2]).toBeLessThan(90);
    expect(l.points[3]).toEqual([xs[2], 2]);
    expect(xs[4]).toBeGreaterThan(600);
    expect(xs[4]).toBeLessThan(690);
  });
});

describe('cabling view highlight', () => {
  const runs = [run('r1', 'a', 'b', 'left'), run('r2', 'a', 'c', 'right'), run('r3', 'b', 'c', 'left')];
  const used = new Map([['a|p/1', 'r1'], ['b|p/2', 'r2'], ['c|p/3', 'r3']]);
  it('every run on a selected connector is highlighted, plus the inspector run', () => {
    expect([...focusedRuns(runs, used, ['a|p/1', 'b|p/2', 'x|free'])].sort()).toEqual(['r1', 'r2']);
    expect([...focusedRuns(runs, used, ['a|p/1'], 'r3')].sort()).toEqual(['r1', 'r3']);
  });
  it('nothing selected or a deleted run highlights nothing', () => {
    expect(focusedRuns(runs, used, []).size).toBe(0);
    expect(focusedRuns(runs, used, [], 'gone').size).toBe(0);
  });
});
