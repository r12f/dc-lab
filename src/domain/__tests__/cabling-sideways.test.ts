import { describe, expect, it } from 'vitest';
import { routeCablingLines, type LegAnchor } from '../../features/designer/cabling-lines';
import type { CableRun } from '../design/types';

describe('cabling lines from side PDUs', () => {
  it('a side PDU outlet leaves sideways at its own height, not via the gap below the tall strip', () => {
    const anchors = new Map<string, LegAnchor>([
      ['pdu', { x: 10, y: 300, gapAbove: 0, gapBelow: 2000, face: 'rear', sideways: true }],
      ['psu', { x: 200, y: 600, gapAbove: 590, gapBelow: 640, face: 'rear' }],
    ]);
    const run: CableRun = { id: 'r', route: 'left', mediaId: 'power-c19-c20', quantity: 1,
      from: [{ placementId: 'p', portRef: 'pdu' }], to: [{ placementId: 'd', portRef: 'psu' }] };
    const [line] = routeCablingLines([run], anchors, (e) => e.portRef, { front: { left: 0, right: 100, width: 40 }, rear: { left: 40, right: 300, width: 40 } }, 10);
    expect(Math.max(...line.points.map(([, y]) => y))).toBeLessThan(2000);
    expect(line.points[2][1]).toBe(300);
  });
});
