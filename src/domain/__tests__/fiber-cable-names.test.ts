import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { genderedConnector } from '../optics/connectors';

describe('fiber cable names', () => {
  const fiber = SHIPPED_CATALOG.cableMedia.filter((c) => c.type === 'fiber-sm' || c.type === 'fiber-mm');
  it('say SMF / MMF and the gender of every pinned/unpinned (MPO/MMC) end', () => {
    for (const c of fiber) {
      expect(c.name, c.id).toMatch(c.type === 'fiber-sm' ? /\bSMF\b/ : /\bMMF\b/);
      for (const e of [c.ends.a, c.ends.b]) {
        if (e.gender) expect(c.name, c.id).toContain(genderedConnector(e.connector, e.gender));
      }
    }
  });
  it('are unique', () => {
    expect(new Set(fiber.map((c) => c.name)).size).toBe(fiber.length);
  });
});
