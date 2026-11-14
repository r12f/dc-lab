import { describe, expect, it } from 'vitest';
import { connectorSlots } from '../optics/connector-slots';

describe('connector slots', () => {
  it('short ends show every connector', () => {
    expect(connectorSlots(4)).toEqual([0, 1, 2, 3]);
    expect(connectorSlots(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('long ends elide the middle, keeping first and last', () => {
    // 160F MPO-8 trunk = 20 connectors: A1-A4, 13 more, A18-A20.
    expect(connectorSlots(20)).toEqual([0, 1, 2, 3, { gap: 13 }, 17, 18, 19]);
    expect(connectorSlots(9)).toEqual([0, 1, 2, 3, { gap: 2 }, 6, 7, 8]);
  });
});
