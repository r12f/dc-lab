import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { planAssignments } from '../design/cable-assign';
import { toggleCrossRack } from '../design/cross-rack';
import type { CableEndpoint } from '../design/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const design = () => {
  const d = newDesign('d', 'D', 'network-42ru-600');
  d.placements.push(
    newPlacement('m1', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 1, face: 'front' }),
    newPlacement('m2', 'switch-48x1g-mgmt', 'M2', { kind: 'rack', position: 2, face: 'front' }),
  );
  return d;
};
const ep = (p: string, i: number): CableEndpoint => ({ placementId: p, portRef: `rj45/${i}` });

describe('cross-rack ports', () => {
  it('marks the selection, and unmarks when all selected are marked', () => {
    const d = design();
    d.crossRack = toggleCrossRack(d, [ep('m1', 1), ep('m1', 2)]).crossRack;
    expect(d.crossRack).toHaveLength(2);
    d.crossRack = toggleCrossRack(d, [ep('m1', 2), ep('m1', 3)]).crossRack;
    expect(d.crossRack.map((e) => e.portRef)).toEqual(['rj45/1', 'rj45/2', 'rj45/3']);
    d.crossRack = toggleCrossRack(d, [ep('m1', 1), ep('m1', 3)]).crossRack;
    expect(d.crossRack.map((e) => e.portRef)).toEqual(['rj45/2']);
  });
  it('a cabled connector cannot be marked; a cross-rack one cannot be cabled', () => {
    const d = design();
    d.cables.push({ id: 'c1', from: [ep('m1', 1)], to: [ep('m2', 1)], route: 'left', mediaId: 'cat6a', quantity: 1 });
    expect(toggleCrossRack(d, [ep('m1', 1)]).error).toMatch(/in-rack cable/);
    d.crossRack = [ep('m1', 2)];
    expect(planAssignments(lib, d, [ep('m1', 2)], [ep('m2', 2)], 'cat6a', 'left').error).toMatch(/cross-rack/);
    expect(planAssignments(lib, d, [ep('m1', 3)], [ep('m2', 3)], 'cat6a', 'left').error).toBeUndefined();
  });
});
