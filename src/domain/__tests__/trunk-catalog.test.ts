import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';

describe('trunk cables', () => {
  it('connector counts carry the fiber count on both ends, and the name states them', () => {
    for (const id of ['mmc16-mpo8-160f-trunk-smf', 'mmc16-288f-trunk-smf', 'mmc16-144f-trunk-smf', 'mpo8-160f-trunk-smf', 'mpo24-288f-trunk-smf']) {
      const c = BUILTIN_CATALOG_FOR_TESTS.cableMedia.find((x) => x.id === id)!;
      const { a, b } = c.ends;
      expect(a.count * a.fibers!, id).toBe(c.fiberCount);
      expect(b.count * b.fibers!, id).toBe(c.fiberCount);
      const g = (x: typeof a) => (x.gender === 'male' ? 'M' : 'F');
      expect(c.name).toBe(`${a.count}x ${a.connector}${g(a)} to ${b.count}x ${b.connector}${g(b)} SMF trunk (${c.fiberCount}F, Type B)`);
    }
  });
});
