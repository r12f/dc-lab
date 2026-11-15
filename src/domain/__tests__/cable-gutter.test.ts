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
    expect(cableGutter(lib, d, 34)).toBeGreaterThan(34);
    const lanes = routeCables(lib, d, rack, rackGeometry(rack, cableGutter(lib, d, 34))).map((r) => r.paths[0][0][0]).sort((x, y) => x - y);
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
    const links = cableLinks(lib, d);
    expect(links.map((l) => [l.placementIds.join('|'), l.route, l.runs.length])).toEqual([['a|b', 'left', 11], ['a|b|c', 'right', 1]]);
    const routed = routeCables(lib, d, rack, rackGeometry(rack, 34));
    expect(routed).toHaveLength(2);
    expect(routed.find((r) => r.link.placementIds.length === 3)!.paths).toHaveLength(4);
  });
  it('left and right runs between the same devices stay separate links on their own sides', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('b', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 5, face: 'front' }),
    );
    const ep = (p: string, i: number) => ({ placementId: p, portRef: `rj45/${i}` });
    d.cables.push({ id: 'l1', from: [ep('a', 1)], to: [ep('b', 1)], route: 'left', mediaId: 'cat6a', quantity: 1 });
    d.cables.push({ id: 'r1', from: [ep('a', 2)], to: [ep('b', 2)], route: 'right', mediaId: 'cat6a', quantity: 1 });
    d.cables.push({ id: 'r2', from: [ep('a', 3)], to: [ep('b', 3)], route: 'right', mediaId: 'cat6a', quantity: 1 });
    expect(cableLinks(lib, d).map((l) => [l.route, l.runs.length]).sort()).toEqual([['left', 1], ['right', 2]]);
  });
  it('a link with every end on the front is not drawn on the rear', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const geo = rackGeometry(rack, 34);
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('b', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 5, face: 'front' }),
    );
    d.cables.push({ id: 'f', from: [{ placementId: 'a', portRef: 'rj45/1' }], to: [{ placementId: 'b', portRef: 'rj45/1' }], route: 'left', mediaId: 'cat6a', quantity: 1 });
    expect(routeCables(lib, d, rack, geo, 'front')).toHaveLength(1);
    expect(routeCables(lib, d, rack, geo, 'rear')).toHaveLength(0);
    // A rear-mounted device's front ports face the rack rear.
    d.placements[1] = { ...d.placements[1], mount: { kind: 'rack', position: 5, face: 'rear' } };
    expect(routeCables(lib, d, rack, geo, 'rear')).toHaveLength(1);
    expect(routeCables(lib, d, rack, geo, 'front')).toHaveLength(1);
  });
  it('a cable with an end on the rear (PSU inlet, PDU in a rear bay) is drawn on the rear', () => {
    const rack = lib.racks.get('network-42ru-600')!;
    const geo = rackGeometry(rack, 34);
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(
      newPlacement('a', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('pdu', 'pdu-vertical-3ph', 'PDU1', { kind: 'side', elementId: 'pdu-bay-l', slot: 1 }),
    );
    // PDU MGMT (rear bay) to a front RJ45: one end on each face.
    d.cables.push({ id: 'm', from: [{ placementId: 'pdu', portRef: 'mgmt/1' }], to: [{ placementId: 'a', portRef: 'rj45/1' }], route: 'left', mediaId: 'cat6a', quantity: 1 });
    // Power cord: PDU outlet to the PSU inlet (rear).
    d.cables.push({ id: 'p', from: [{ placementId: 'pdu', portRef: 'bank-a-c13/1' }], to: [{ placementId: 'a', portRef: 'psu/1' }], route: 'left', mediaId: 'power-c13-c14', quantity: 1 });
    expect(cableLinks(lib, d).map((l) => [l.runs[0].id, l.faces.join('+')]).sort()).toEqual([['m', 'front+rear'], ['p', 'rear']]);
    expect(routeCables(lib, d, rack, geo, 'rear').map((r) => r.link.runs[0].id).sort()).toEqual(['m', 'p']);
  });
});
