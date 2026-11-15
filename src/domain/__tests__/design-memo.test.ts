import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { designIssues } from '../design/issues';
import { cableIssues } from '../design/connectors';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('derived design data is cached per snapshot', () => {
  it('same design object -> same result; an edited copy is recomputed', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('m1', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }));
    expect(computeRackMetrics(lib, d)).toBe(computeRackMetrics(lib, d));
    expect(designIssues(lib, d)).toBe(designIssues(lib, d));
    const e = { ...d, placements: [...d.placements, newPlacement('m2', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 2, face: 'front' })] };
    expect(computeRackMetrics(lib, e).deviceCount).toBe(2);
    expect(computeRackMetrics(lib, d).deviceCount).toBe(1);
  });
  it('a connector used by two runs is still reported', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(
      newPlacement('m1', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
      newPlacement('m2', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 2, face: 'front' }),
    );
    const ep = (p: string, i: number) => ({ placementId: p, portRef: `osfp/${i}`, connector: 1 });
    d.cables.push(
      { id: 'a', from: [ep('m1', 1)], to: [ep('m2', 1)], route: 'left', mediaId: 'cat6a', quantity: 1 },
      { id: 'b', from: [ep('m1', 1)], to: [ep('m2', 2)], route: 'left', mediaId: 'cat6a', quantity: 1 },
    );
    expect(cableIssues(lib, d, d.cables[1]).some((i) => /already connected/.test(i))).toBe(true);
  });
});
