import { describe, expect, it } from 'vitest';
import { cableGroupsOnFace, drawOrder, portCell, withPassThrough } from '../device/ports';
import type { PortGroup } from '../device/types';
import { layoutFace } from '../../features/devices/drawing/faceplate-layout';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';

const g: PortGroup = { id: 'p', label: 'P', role: 'data', formFactor: 'MMC-16', count: 4, speedGbps: 0, lanes: 0, face: 'rear', rows: 1, breakoutModes: [] };

describe('rightToLeft port groups', () => {
  it('mirrors columns', () => {
    expect([0, 1, 2, 3].map((i) => portCell(g, i).col)).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((i) => portCell({ ...g, rightToLeft: true }, i).col)).toEqual([3, 2, 1, 0]);
  });
  it('fiber housing rear is the mirror of its front', () => {
    const d = withPassThrough(BUILTIN_CATALOG_FOR_TESTS.devices.find((x) => x.id === 'fiber-housing-80xmmc16')!);
    const front = layoutFace(d, 'front');
    const rear = layoutFace(d, 'rear', front.width);
    const at = (l: typeof front, ref: string) => l.ports.find((p) => p.ref === ref)!;
    for (const i of [1, 5, 7, 10]) {
      const f = at(front, `fm1/${i}`); const r = at(rear, `rm1/${i}`);
      expect(r.y).toBe(f.y);
      expect(r.x + r.w / 2).toBeCloseTo(front.width - (f.x + f.w / 2), 5);
    }
  });
  it('cabling view draws the housing rear modules right to left', () => {
    const d = withPassThrough(BUILTIN_CATALOG_FOR_TESTS.devices.find((x) => x.id === 'fiber-housing-80xmmc16')!);
    expect(drawOrder(cableGroupsOnFace(d, 'rear')).map((g) => g.id)).toEqual(['rm4', 'rm3', 'rm2', 'rm1']);
    expect(drawOrder(cableGroupsOnFace(d, 'front')).map((g) => g.id)).toEqual(['fm1', 'fm2', 'fm3', 'fm4']);
  });
});
