import { describe, expect, it } from 'vitest';
import { routeCablingLines, type LegAnchor } from '../../features/designer/cabling-lines';
import type { CableRun } from '../design/types';

const key = (e: { placementId: string; portRef: string }) => `${e.placementId}|${e.portRef}`;
const anchor = (x: number, y: number, top: number, bottom: number): LegAnchor => ({ x, y, gapAbove: top, gapBelow: bottom });
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
  const channel = { left: 0, right: 500, width: 90 };

  it('turns at the nearer device gap and runs in the chosen side channel', () => {
    const [l] = routeCablingLines([run('r', 'a', 'b', 'left')], anchors, key, channel);
    expect(l.points[0]).toEqual([200, 20]);
    expect(l.points[1]).toEqual([200, 5]);
    expect(l.points[2][0]).toBeLessThan(90);
    expect(l.points.at(-1)).toEqual([300, 100]);
    const [r] = routeCablingLines([run('r', 'a', 'b', 'right')], anchors, key, channel);
    expect(r.points[2][0]).toBeGreaterThan(500);
  });

  it('nests lanes on one side: the longer run lies outside the shorter', () => {
    const lines = routeCablingLines([run('long', 'a', 'c', 'left'), run('short', 'a', 'b', 'left')], anchors, key, channel);
    const lane = (id: string) => lines.find((l) => l.runId === id)!.points[2][0];
    expect(lane('long')).toBeLessThan(lane('short'));
  });

  it('a breakout draws one line per B connector, all in the run lane', () => {
    const r: CableRun = { ...run('y', 'a', 'b', 'right'), to: [{ placementId: 'b', portRef: 'p/1' }, { placementId: 'c', portRef: 'p/1' }] };
    const lines = routeCablingLines([r], anchors, key, channel);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((l) => l.points[2][0])).size).toBe(1);
  });
});
