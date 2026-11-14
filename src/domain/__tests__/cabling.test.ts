import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { estimateLengthM, effectiveLengthM } from '../design/cabling';
import { buildRackBom } from '../bom/rack-bom';
import { normalizeProject } from '../project/serializer';
import type { CableRun } from '../design/types';

// Network 42RU 600 mm: PDU bay (100) + sidepod (300) on each side.
const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const d = newDesign('d', 'D', 'network-42ru-600');
d.placements.push(
  newPlacement('a', 'switch-32x400g-qsfpdd', 'A', { kind: 'rack', position: 1, face: 'front' }),
  newPlacement('b', 'switch-32x400g-qsfpdd', 'B', { kind: 'rack', position: 21, face: 'front' }),
  newPlacement('s', 'switch-48x1g-mgmt', 'S', { kind: 'side', elementId: 'sidepod-l', slot: 1 }),
);
const run = (from: string, to: string, route: 'left' | 'right'): CableRun =>
  ({ id: 'c', from: [{ placementId: from, portRef: '' }], to: [{ placementId: to, portRef: '' }], route, mediaId: 'lc-smf', quantity: 2 });

describe('in-rack cabling', () => {
  it('rack to rack: half body each end + 20 RU vertical + slack, rounded up', () => {
    // 300 + 300 + 20 * 44.45 = 1489 mm -> 1.489 + 0.5 = 1.989 -> 2.0 m
    expect(estimateLengthM(lib, d, run('a', 'b', 'left'))).toBe(2);
  });
  it('side-mounted device: route on its own side is shorter than across the rack', () => {
    const near = estimateLengthM(lib, d, run('s', 'a', 'left'))!;
    const far = estimateLengthM(lib, d, run('s', 'a', 'right'))!;
    expect(far - near).toBeGreaterThanOrEqual(0.5);
  });
  it('manual length overrides; BOM uses the effective length', () => {
    expect(effectiveLengthM(lib, d, { ...run('a', 'b', 'left'), lengthM: 5 })).toBe(5);
    const bom = buildRackBom(lib, { ...d, cables: [run('a', 'b', 'left')] });
    const line = bom.find((l) => l.kind === 'cable')!;
    expect(line.item).toBe('LC to LC SMF duplex patch (2F) 2 m');
    expect(line.qty).toBe(2);
    expect(line.lengthM).toBe(4);
  });
  it('legacy runs get a left route', () => {
    const p = normalizeProject({ rackDesigns: [{ id: 'd', placements: [], cables: [{ id: 'c', lengthM: 3 }] }] });
    expect(p.rackDesigns[0].cables[0]).toMatchObject({ route: 'left', lengthM: 3, from: [], to: [] });
  });
});
