import { describe, expect, it } from 'vitest';
import { Library } from '../library/Library';
import { emptyProject } from '../project/types';
import { newDesign } from '../design/factory';
import { defaultMount, placementProblem } from '../design/placement';
import { newSideElement } from '../rack/sideElements';
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
