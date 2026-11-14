import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { rackGeometry } from '../../drawing/rack-geometry';
import { routeCables } from '../../features/designer/cable-routes';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('elevation cable lanes', () => {
  it('run in the gutter outside the rails, never over the unit numbers', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const geo = rackGeometry(rack, 34);
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-32x400g-qsfpdd', 'SW1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('b', 'switch-32x400g-qsfpdd', 'SW2', { kind: 'rack', position: 20, face: 'front' }),
    );
    for (const route of ['left', 'right'] as const) {
      d.cables = [{ id: route, from: [{ placementId: 'a', portRef: '' }], to: [{ placementId: 'b', portRef: '' }], route, mediaId: 'lc-smf', quantity: 1 }];
      const [spine] = routeCables(lib, d, rack, geo)[0].paths;
      const x = spine[0][0];
      if (route === 'left') expect(x).toBeLessThan(geo.originX);
      else expect(x).toBeGreaterThan(geo.originX + geo.railW * 2 + geo.bodyW);
    }
    // Side elements moved out by the gutter.
    const plain = rackGeometry(rack);
    expect(geo.width - plain.width).toBe(68);
  });
});
