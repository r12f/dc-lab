import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { normalizeProject } from '../project/serializer';

describe('network racks', () => {
  it('every built-in network rack is 600 mm wide', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const net = lib.racks.items().filter((r) => r.kind === 'network');
    expect(net.map((r) => r.id).sort()).toEqual(['network-42ru-600', 'network-42ru-600-sidepods', 'network-48ru-600', 'network-48ru-600-sidepods']);
    for (const r of net) expect(r.widthMm).toBe(600);
  });
  it('designs on the old 48RU 800 mm template move to the 600 mm one', () => {
    const p = normalizeProject({ rackDesigns: [{ id: 'd', name: 'D', templateId: 'network-48ru-800', placements: [], cables: [] }] });
    expect(p.rackDesigns[0].templateId).toBe('network-48ru-600');
  });
});
