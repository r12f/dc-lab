import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { faceRows, groupCols, groupsOnFace, portCell, portName, withPassThrough } from '../device/ports';

const d = withPassThrough(BUILTIN_CATALOG_FOR_TESTS.devices.find((x) => x.id === 'fiber-housing-2ru-288xmmc16')!);

describe('face rows (2RU 288x MMC-16 housing)', () => {
  it('splits each face into a top and a bottom row of 8 blocks', () => {
    for (const face of ['front', 'rear'] as const) {
      const rows = faceRows(groupsOnFace(d, face));
      expect(rows.map((r) => r.length)).toEqual([8, 8]);
      expect(rows.flat().reduce((n, g) => n + g.count, 0)).toBe(288);
    }
  });

  it('numbers a block top down, then left to right: 3 columns of 6', () => {
    const g = groupsOnFace(d, 'front')[0];
    expect(groupCols(g)).toBe(3);
    expect([0, 5, 6, 17].map((i) => portCell(g, i))).toEqual([
      { col: 0, row: 0 }, { col: 0, row: 5 }, { col: 1, row: 0 }, { col: 2, row: 5 }]);
    expect([1, 18].map((i) => portName(g, i))).toEqual(['1', '18']);
    const bottom = faceRows(groupsOnFace(d, 'front'))[1];
    expect(portName(bottom[0], 1)).toBe('145');
    expect(portName(bottom[7], 18)).toBe('288');
  });

  it('a mirrored column-major group keeps its full width', () => {
    const rear = groupsOnFace(d, 'rear')[0];
    expect(rear.rightToLeft).toBe(true);
    expect(groupCols(rear)).toBe(3);
    expect(portCell(rear, 0).col).toBe(2);
  });
});
