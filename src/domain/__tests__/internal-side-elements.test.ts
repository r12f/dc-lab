import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { isInternal, overallWidthMm } from '../rack/side-elements';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { estimateLengthM } from '../design/cabling';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('PDU bays are inside the rack', () => {
  it('add no footprint width; sidepods do', () => {
    const r = lib.racks.get('network-42ru-600-sidepods')!;
    expect(r.sideElements.filter(isInternal).map((e) => e.id)).toEqual(['pdu-bay-l', 'pdu-bay-r']);
    expect(overallWidthMm(r.widthMm, r.sideElements)).toBe(600 + 300 + 300);
  });
  it('a sidepod device is no farther from the channel because of the PDU bay', () => {
    const d = newDesign('d', 'D', 'network-42ru-600-sidepods');
    d.placements.push(
      newPlacement('s', 'switch-48x1g-mgmt', 'S', { kind: 'side', elementId: 'sidepod-l', slot: 1 }),
      newPlacement('p', 'pdu-vertical-3ph', 'P', { kind: 'side', elementId: 'pdu-bay-l', slot: 1 }),
    );
    const run = (from: string) => ({ from: [{ placementId: from, portRef: '' }], to: [{ placementId: 'p', portRef: '' }], route: 'left' as const });
    // Sidepod centre: 150 mm (half its width), not 100 + 150 through the PDU bay.
    // sidepod 150 + bay 50 + 0 vertical + 0.5 slack = 0.7 -> 1.0 m
    expect(estimateLengthM(lib, d, run('s'))).toBe(1);
  });
});
