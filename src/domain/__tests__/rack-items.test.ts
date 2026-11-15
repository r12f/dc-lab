import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { buildRackBom } from '../bom/rack-bom';
import { buildRackBomTree } from '../bom/rack-bom-tree';
import type { ItemVariant } from '../items/types';

describe('rack template items', () => {
  it('a rack template has items; the default one is the BOM rack line (vendor / PN, properties)', () => {
    const base = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    expect(base.variants.of('network-42ru-600')[0]?.target).toBe('rack');
    const item: ItemVariant = { id: 'r1', name: 'x', target: 'rack', itemId: 'network-42ru-600', vendor: 'Acme', model: 'RK-48', isDefault: true, properties: { pn: 'P-1' } };
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), variants: [item] });
    const d = newDesign('d', 'D', 'network-42ru-600');
    const flat = buildRackBom(lib, d).find((l) => l.kind === 'rack')!;
    expect([flat.vendorModel, flat.properties?.pn]).toEqual(['Acme RK-48', 'P-1']);
    const frame = buildRackBomTree(lib, d)!.children[0].line!;
    expect([frame.vendorModel, frame.properties?.pn]).toEqual(['Acme RK-48', 'P-1']);
  });
});
