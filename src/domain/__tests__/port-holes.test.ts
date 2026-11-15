import { describe, expect, it } from 'vitest';
import { groupCols, portCell } from '../device/ports';
import type { PortGroup } from '../device/types';

// One fiber-housing module: a single 2x MMC slot top-left, a 3x3 block of 2x MMC slots beside it (6 rows).
const module: PortGroup = { id: 'm1', label: 'M1', role: 'data', formFactor: 'MMC-16', count: 20, speedGbps: 0, lanes: 16,
  face: 'front', rows: 6, breakoutModes: [], holes: [2, 3, 4, 5] };

describe('port grid holes', () => {
  it('ports skip the empty cells: 1-2 fill the top of column 0, 3-20 the 3x6 block', () => {
    expect([0, 1].map((i) => portCell(module, i))).toEqual([{ col: 0, row: 0 }, { col: 0, row: 1 }]);
    expect(portCell(module, 2)).toEqual({ col: 1, row: 0 });
    expect(portCell(module, 19)).toEqual({ col: 3, row: 5 });
    expect(groupCols(module)).toBe(4);
  });
  it('no holes: plain column-major', () => {
    const g = { ...module, holes: undefined, count: 12 };
    expect(portCell(g, 7)).toEqual({ col: 1, row: 1 });
    expect(groupCols(g)).toBe(2);
  });
});
