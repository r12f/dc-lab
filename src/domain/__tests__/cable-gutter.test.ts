import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { rackGeometry } from '../../drawing/rack-geometry';
import { cableGutter, cableLinks, LANE_MIN, routeCables } from '../../features/designer/cable-routes';

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
  it('the channel widens with the run count so lanes stay at least LANE_MIN apart', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
    );
    // 40 distinct device pairs (cables between the same pair would be one link).
    for (let i = 1; i <= 40; i++) {
      d.placements.push(newPlacement(`x${i}`, 'switch-48x1g-mgmt', `X${i}`, { kind: 'rack', position: i + 1, face: 'front' }));
      d.cables.push({ id: `c${i}`, from: [{ placementId: 'a', portRef: `rj45/${i}` }], to: [{ placementId: `x${i}`, portRef: 'rj45/1' }], route: 'left', mediaId: 'cat6a', quantity: 1 });
    }
    expect(cableGutter(d, 34)).toBeGreaterThan(34);
    const lanes = routeCables(lib, d, rack, rackGeometry(rack, cableGutter(d, 34))).map((r) => r.paths[0][0][0]).sort((x, y) => x - y);
    for (let i = 1; i < lanes.length; i++) expect(lanes[i] - lanes[i - 1]).toBeGreaterThanOrEqual(LANE_MIN - 1e-9);
  });
  it('cables between the same devices are one link (one lane); a breakout joins all its devices', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('b', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 5, face: 'front' }),
      newPlacement('c', 'switch-48x1g-mgmt', 'M3', { kind: 'rack', position: 9, face: 'front' }),
    );
    const ep = (p: string, i: number) => ({ placementId: p, portRef: `rj45/${i}` });
    for (let i = 1; i <= 10; i++) d.cables.push({ id: `ab${i}`, from: [ep('a', i)], to: [ep('b', i)], route: 'left', mediaId: 'cat6a', quantity: 1 });
    d.cables.push({ id: 'ba', from: [ep('b', 20)], to: [ep('a', 20)], route: 'left', mediaId: 'cat6a', quantity: 1 });
    d.cables.push({ id: 'y', from: [ep('a', 30)], to: [ep('b', 30), ep('c', 30)], route: 'right', mediaId: 'cat6a', quantity: 1 });
    const links = cableLinks(d);
    expect(links.map((l) => [l.key, l.runs.length])).toEqual([['a|b', 11], ['a|b|c', 1]]);
    const routed = routeCables(lib, d, rack, rackGeometry(rack, 34));
    expect(routed).toHaveLength(2);
    expect(routed.find((r) => r.link.key === 'a|b|c')!.paths).toHaveLength(4);
  });
});
