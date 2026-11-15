import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { normalizeProject } from '../project/serializer';

const rack = (id: string) => SHIPPED_CATALOG.racks.find((r) => r.id === id)!;
const kinds = (id: string) => rack(id).sideElements.map((e) => `${e.side}:${e.kind}`);

describe('network racks with and without sidepods', () => {
  it('plain 42RU / 48RU have only a PDU bay each side, 1 tile wide; "(w/ Sidepods)" add a sidepod each side', () => {
    for (const ru of ['42', '48']) {
      const id = `network-${ru}ru-600`;
      expect(kinds(id), id).toEqual(['left:pdu-bay', 'right:pdu-bay']);
      expect(rack(id).footprintTiles.wide).toBe(1);
      const pods = rack(`${id}-sidepods`);
      expect([pods.name, pods.units, pods.footprintTiles.wide]).toEqual([`Network Rack ${ru}RU (w/ Sidepods)`, Number(ru), 2]);
      expect(kinds(pods.id)).toEqual(['left:pdu-bay', 'left:sidepod', 'right:pdu-bay', 'right:sidepod']);
    }
  });
  it('old designs that mount devices in a sidepod move to the "(w/ Sidepods)" template; others stay', () => {
    const pl = (id: string, elementId: string) => ({ id, deviceId: 'x', label: id, mount: { kind: 'side', elementId, slot: 1 }, portSettings: {}, groupSettings: {} });
    const p = normalizeProject({ rackDesigns: [
      { id: 'a', name: 'A', templateId: 'network-42ru-600', placements: [pl('s', 'sidepod-l')], cables: [] },
      { id: 'b', name: 'B', templateId: 'network-48ru-600', placements: [pl('p', 'pdu-bay-l')], cables: [] },
    ] });
    expect(p.rackDesigns.map((d) => d.templateId)).toEqual(['network-42ru-600-sidepods', 'network-48ru-600']);
  });
});
