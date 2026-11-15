import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { newDesign } from '../design/factory';
import { defaultMount, placementProblem } from '../design/placement';
import { defaultSideElements, newSideElement, footprintTiles } from '../rack/side-elements';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { normalizeProject } from '../project/serializer';
import type { DeviceDefinition } from '../device/types';
import type { RackTemplate } from '../rack/types';
import pdu from '../../catalog/devices/pdu-vertical-3ph.json';
import sw from '../../catalog/devices/switch-64x800g-osfp.json';
import rack from '../../catalog/racks/network-42ru-600.json';

const r = rack as unknown as RackTemplate;
const withSides: RackTemplate = {
  ...r,
  sideElements: [
    newSideElement('bay', 'pdu-bay', 'left', 1200),
    newSideElement('pod', 'sidepod', 'right', 1200),
    newSideElement('cm', 'cable-manager', 'right', 1200),
  ],
};
const lib = new Library(
  { devices: [pdu as unknown as DeviceDefinition, sw as unknown as DeviceDefinition], racks: [withSides], optics: [], cableMedia: [] },
  emptyProject(),
);

describe('default side elements', () => {
  it('network racks: a PDU bay on each side (+ a sidepod each with sidepods); server racks: none', () => {
    expect(defaultSideElements('network', 1200).map((e) => `${e.side}:${e.kind}`)).toEqual(['left:pdu-bay', 'right:pdu-bay']);
    const els = defaultSideElements('network', 1200, true);
    expect(els.map((e) => `${e.side}:${e.kind}`)).toEqual(['left:pdu-bay', 'left:sidepod', 'right:pdu-bay', 'right:sidepod']);
    for (const k of ['server', 'mgx', 'orv3', 'orw']) expect(defaultSideElements(k, 1200)).toEqual([]);
  });
  it('built-in templates follow the defaults', () => {
    const sides = (els: { side: string; kind: string }[]) => els.map((e) => `${e.side}:${e.kind}`);
    // "(PDU+SidePods)" / "(w/ Sidepods)" variants carry network-rack side elements with sidepods (MGX too).
    for (const r of BUILTIN_CATALOG_FOR_TESTS.racks) {
      const pods = /\(PDU\+SidePods\)|\(w\/ Sidepods\)/.test(r.name);
      const kind = pods ? 'network' : r.kind;
      expect(sides(r.sideElements), r.id).toEqual(sides(defaultSideElements(kind, r.depthMm, pods)));
    }
  });
  const sides = (els: { side: string; kind: string }[]) => els.map((e) => `${e.side}:${e.kind}`);
  it('MGX (PDU+SidePods) is an MGX rack with a PDU bay + sidepod on each side, 2 tiles wide', () => {
    const r = BUILTIN_CATALOG_FOR_TESTS.racks.find((x) => x.id === 'mgx-48ru-pdu-sidepods')!;
    expect(r.kind).toBe('mgx');
    expect(sides(r.sideElements)).toEqual(['left:pdu-bay', 'left:sidepod', 'right:pdu-bay', 'right:sidepod']);
    expect(footprintTiles(r)).toEqual({ wide: 2, deep: 2 }); // 600 + 2x300 mm sidepods = 1200 mm = 2 tiles
  });
});

describe('side elements', () => {
  const design = newDesign('d', 'D', withSides.id);
  it('PDU defaults to the first accepting slot', () => {
    expect(defaultMount(lib, design, lib.devices.get(pdu.id)!)).toEqual({ kind: 'side', elementId: 'bay', slot: 1 });
  });
  it('kind decides what fits', () => {
    const s = lib.devices.get(sw.id)!;
    expect(placementProblem(lib, design, s, { kind: 'side', elementId: 'bay', slot: 1 })).toMatch(/does not accept/);
    expect(placementProblem(lib, design, s, { kind: 'side', elementId: 'pod', slot: 1 })).toBeUndefined();
    expect(placementProblem(lib, design, s, { kind: 'side', elementId: 'cm', slot: 1 })).toMatch(/does not accept|no slot/);
  });
  it('migrates legacy sidePods and side mounts', () => {
    const p = normalizeProject({
      racks: [{ id: 'x', depthMm: 1000, sidePods: { left: 2, right: 0 } }],
      rackDesigns: [{ id: 'd', placements: [{ id: 'p', mount: { kind: 'side', side: 'left', slot: 2 }, portSettings: {}, groupSettings: {} }] }],
    });
    expect(p.racks[0].sideElements).toHaveLength(1);
    expect(p.racks[0].sideElements[0]).toMatchObject({ id: 'sidepod-left', slots: 2, side: 'left' });
    expect(p.rackDesigns[0].placements[0].mount).toEqual({ kind: 'side', elementId: 'sidepod-left', slot: 2 });
  });
});
