import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { defaultMount, newPlacement, placementProblem } from '../design/placement';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const pdu = lib.devices.get('pdu-vertical-3ph')!;

describe('zero-U devices', () => {
  it('are rejected in the rack body and accepted in a PDU bay', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    expect(placementProblem(lib, d, pdu, { kind: 'rack', position: 1, face: 'front' })).toMatch(/side element/);
    expect(placementProblem(lib, d, pdu, { kind: 'side', elementId: 'pdu-bay-l', slot: 1 })).toBeUndefined();
  });
  it('never default to the rack body when the side slots are full or missing', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    expect(defaultMount(lib, d, pdu)).toEqual({ kind: 'side', elementId: 'pdu-bay-l', slot: 1 });
    for (const el of ['pdu-bay-l', 'pdu-bay-r', 'sidepod-l', 'sidepod-r']) {
      d.placements.push(newPlacement(el, 'pdu-vertical-3ph', el, { kind: 'side', elementId: el, slot: 1 }));
    }
    expect(defaultMount(lib, d, pdu)).toBeUndefined();
    expect(defaultMount(lib, newDesign('m', 'M', 'mgx-48ru'), pdu)).toBeUndefined();
  });
});
