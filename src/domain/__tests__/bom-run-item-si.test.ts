import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { buildRackBom } from '../bom/rack-bom';
import { buildRackBomTree, treeLines } from '../bom/rack-bom-tree';
import { bomColumns, SI_HEADER } from '../bom/columns';
import type { ItemVariant } from '../items/types';
import type { CableRun } from '../design/types';

const cord = (id: string, model: string): ItemVariant => ({ id, name: model, target: 'cable', itemId: 'mpo8-smf', vendor: 'V', model, properties: {} });
const run = (id: string, itemId?: string): CableRun => ({ id, from: [], to: [], route: 'left', mediaId: 'mpo8-smf', lengthM: 2, quantity: 1, ...(itemId ? { itemId } : {}) });

describe('cable run item and SI-adjustable BOM lines', () => {
  const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [cord('red', 'RED'), cord('blue', 'BLUE')] });
  const base = { ...newDesign('d', 'D', 'network-42ru-600'), cables: [run('a', 'red'), run('b'), run('c')], bomItems: { 'mpo8-smf@2': 'blue' } };

  it('an item fixed on the run wins over the BOM pick and is its own, non-pickable line', () => {
    const lines = buildRackBom(lib, base).filter((l) => l.kind === 'cable').map((l) => [l.vendorModel, l.qty, !!l.itemFixed, l.pickKey]);
    expect(lines).toEqual([['V RED', 1, true, undefined], ['V BLUE', 2, false, 'mpo8-smf@2']]);
    expect(treeLines(buildRackBomTree(lib, base)).filter((l) => l.kind === 'cable').map((l) => l.vendorModel).sort()).toEqual(['V BLUE', 'V RED']);
  });
  it('SI may adjust: a per-line flag stored on the design, shown as a BOM column', () => {
    const d = { ...base, bomSiAdjustable: { 'mpo8-smf@2': true } };
    const lines = buildRackBom(lib, d).filter((l) => l.kind === 'cable');
    expect(lines.map((l) => [l.vendorModel, !!l.siAdjustable])).toEqual([['V RED', false], ['V BLUE', true]]);
    const col = bomColumns([]).find((c) => c.header === SI_HEADER)!;
    expect(lines.map((l) => col.cell(l))).toEqual(['', 'Yes']);
  });
});
