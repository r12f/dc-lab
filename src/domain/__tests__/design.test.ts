import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { newDesign } from '../design/factory';
import { newPlacement, placementProblem, firstFreePosition, defaultMount } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';
import type { DeviceDefinition } from '../device/types';
import type { RackTemplate } from '../rack/types';
import type { OpticDefinition } from '../optics/types';
import sw from '../../catalog/devices/switch-64x800g-osfp.json';
import pdu from '../../catalog/devices/pdu-vertical-3ph.json';
import rack from '../../catalog/racks/network-42ru-600-sidepods.json';
import optic from '../../catalog/optics/osfp-800g-2xdr4-ihs.json';

const builtin = {
  devices: [sw as unknown as DeviceDefinition, pdu as unknown as DeviceDefinition],
  racks: [rack as unknown as RackTemplate],
  optics: [optic as OpticDefinition],
  cableMedia: [],
};
const lib = new Library(builtin, emptyProject());

describe('rack design', () => {
  const design = newDesign('d', 'D', rack.id);
  const p1 = newPlacement('p1', sw.id, 'SW1', { kind: 'rack', position: 1, face: 'front' });
  p1.groupSettings = { osfp: { opticId: optic.id } };
  design.placements.push(p1, newPlacement('p2', pdu.id, 'PDU1', { kind: 'side', elementId: 'pdu-bay-l', slot: 1 }));

  it('detects overlap and finds the next free unit', () => {
    const d = lib.devices.get(sw.id)!;
    expect(placementProblem(lib, design, d, { kind: 'rack', position: 2, face: 'rear' })).toMatch(/Overlaps/);
    expect(firstFreePosition(lib, design, d)).toBe(3);
    expect(placementProblem(lib, design, d, { kind: 'rack', position: 42, face: 'front' })).toMatch(/Does not fit/);
  });
  it('defaults zero-U devices to a free side slot', () => {
    expect(defaultMount(lib, design, lib.devices.get(pdu.id)!)).toEqual({ kind: 'side', elementId: 'pdu-bay-r', slot: 1 });
  });
  it('rejects occupied and missing side slots', () => {
    const s = lib.devices.get(sw.id)!;
    expect(placementProblem(lib, design, s, { kind: 'side', elementId: 'pdu-bay-l', slot: 1 })).toMatch(/does not accept/);
    expect(placementProblem(lib, design, lib.devices.get(pdu.id)!, { kind: 'side', elementId: 'pdu-bay-l', slot: 1 })).toMatch(/occupied/);
    expect(placementProblem(lib, design, s, { kind: 'side', elementId: 'sidepod-r', slot: 2 })).toMatch(/no slot/);
  });
  it('sums power including optics', () => {
    const m = computeRackMetrics(lib, design);
    expect(m.typicalW).toBe(sw.power.typicalW + pdu.power.typicalW + 64 * optic.powerW);
    expect(m.supplyCapacityW).toBe(pdu.power.capacityW);
    expect(m.usedUnits).toBe(2);
  });
  it('builds a BOM with optics', () => {
    const bom = buildRackBom(lib, design);
    expect(bom.find((l) => l.kind === 'optic')?.qty).toBe(64);
    expect(bom.filter((l) => l.kind === 'device')).toHaveLength(2);
  });
});
