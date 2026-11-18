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
      newPlacement('r', 'switch-48x1g-mgmt', 'R', { kind: 'rack', position: 28, face: 'front' }),
    );
    const run = (from: string) => ({ from: [{ placementId: from, portRef: '' }], to: [{ placementId: 'r', portRef: '' }], route: 'left' as const });
    // Sidepod centre: 150 mm (half its width), not 100 + 150 through the PDU bay.
    // sidepod 150 + rack half body 300 + vertical (27.5 - 21) RU = 289 mm + 0.2 slack = 0.939 -> 1.0 m
    // (through the bay it would be 1.039 -> 1.5 m)
    expect(estimateLengthM(lib, d, run('s'))).toBe(1);
  });
});
