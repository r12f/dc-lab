import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { estimateLengthM } from '../design/cabling';

describe('power cord length from a vertical PDU', () => {
  it('uses the outlet\'s own height on the strip: a top outlet to a top device is shorter than a bottom outlet', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const rack = lib.racks.get('network-48ru-600')!;
    const bay = rack.sideElements.find((e) => e.kind === 'pdu-bay')!;
    const pdu = lib.devices.items().find((x) => x.category === 'pdu' && x.height.units === 0 && x.ports.some((g) => g.role === 'outlet' && g.count >= 6))!;
    const og = pdu.ports.filter((g) => g.role === 'outlet');
    const last = og[og.length - 1];
    const d = newDesign('d', 'D', rack.id);
    d.placements.push(newPlacement('pdu', pdu.id, 'PDU1', { kind: 'side', elementId: bay.id, slot: 1 }));
    d.placements.push(newPlacement('sw', 'switch-48x1g-mgmt', 'MS1', { kind: 'rack', position: rack.units, face: 'rear' }));
    const len = (portRef: string) => estimateLengthM(lib, d, { route: bay.side, from: [{ placementId: 'pdu', portRef }], to: [{ placementId: 'sw', portRef: 'psu/1' }] })!;
    expect(len(`${og[0].id}/1`)).toBeLessThan(len(`${last.id}/${last.count}`));
  });
});
