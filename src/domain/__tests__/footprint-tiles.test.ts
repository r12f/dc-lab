import { expect, it } from 'vitest';
import { footprintTiles } from '../rack/side-elements';
import { normalizeProject } from '../project/serializer';
import { SHIPPED_CATALOG } from './catalog-fixture';

const el = (kind: 'sidepod' | 'pdu-bay', widthMm: number) => ({ id: kind, name: kind, kind, side: 'left' as const, widthMm, depthMm: 1200, slots: 1, weightKg: 0 });

it('footprint tiles are computed: body + outside side elements over 600 mm, half tiles; PDU bays add nothing', () => {
  expect(footprintTiles({ widthMm: 600, depthMm: 1200, sideElements: [el('pdu-bay', 100), el('sidepod', 300), el('sidepod', 300)] })).toEqual({ wide: 2, deep: 2 });
  expect(footprintTiles({ widthMm: 750, depthMm: 1068, sideElements: [] })).toEqual({ wide: 1.5, deep: 2 });
  expect(footprintTiles({ widthMm: 600, depthMm: 1200, sideElements: [el('sidepod', 302), el('sidepod', 302)] }).wide).toBe(2.5);
  expect(Object.fromEntries(SHIPPED_CATALOG.racks.map((r) => [r.id, footprintTiles(r).wide]))).toMatchObject({
    'network-42ru-600': 1, 'network-42ru-600-sidepods': 2, 'mgx-48ru-pdu-sidepods': 2, 'orw-48ou': 2, 'orv3-44ou': 1,
  });
});
it('a stored footprintTiles is dropped on load', () => {
  const p = normalizeProject({ racks: [{ ...SHIPPED_CATALOG.racks[0], id: 'x', footprintTiles: { wide: 3, deep: 2 } }] });
  expect(p.racks[0]).not.toHaveProperty('footprintTiles');
});
