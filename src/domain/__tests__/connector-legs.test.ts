import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { legMode, legReach, portLegs } from '../ports/legs';
import { resolvePort } from '../device/port-settings';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { applicableCables, endpointLeg, planCable } from '../design/cable-assign';
import type { CableEndpoint } from '../design/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const sw = lib.devices.get('switch-64x800g-osfp')!;
const osfp = sw.ports.find((g) => g.id === 'osfp')!;

describe('port legs (connector view)', () => {
  it('splits mode and reach over the module connectors: 8x100G 2xDR4 = 2 x "4x100G DR4 MPO-12"', () => {
    expect(legMode('8x100G', 2)).toBe('4x100G');
    expect(legMode('1x800G', 2)).toBe('400G');
    expect(legMode('2x400G', 2)).toBe('400G');
    expect(legReach('2xDR4', 2)).toBe('DR4');
    expect(legReach('DR8', 1)).toBe('DR8');
    const r = resolvePort(lib, sw, 'osfp/1', { id: 'p', name: 'p', groupDefaults: { osfp: { mode: '8x100G', reach: '2xDR4' } }, overrides: {} });
    expect(portLegs(osfp, r).map((l) => l.label)).toEqual(['4x100G DR4 MPO-12F', '4x100G DR4 MPO-12F']);
  });
  it('a port with no module is one leg on the port itself', () => {
    const rj = lib.devices.get('switch-48x1g-mgmt')!.ports.find((g) => g.id === 'rj45')!;
    const legs = portLegs(rj, resolvePort(lib, lib.devices.get('switch-48x1g-mgmt')!, 'rj45/1'));
    expect(legs).toHaveLength(1);
    expect(legs[0].index).toBeUndefined();
    expect(legs[0]).toMatchObject({ connector: 'RJ45', mode: '1G' });
  });
});

describe('applicable cables in the cabling view', () => {
  const d = newDesign('d', 'D', 'network-42ru-600');
  d.placements.push(
    { ...newPlacement('a', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }), breakoutProfileId: 'all-2x400g' },
    { ...newPlacement('b', 'switch-64x800g-osfp', 'SW2', { kind: 'rack', position: 3, face: 'front' }), breakoutProfileId: 'all-2x400g' },
    newPlacement('m', 'switch-48x1g-mgmt', 'M1', { kind: 'rack', position: 5, face: 'front' }),
  );
  const leg = (placementId: string, port: string, connector?: number): CableEndpoint => ({ placementId, portRef: port, connector });
  it('MPO-12 DR4 legs on both ends: only SMF MPO-12 cables (no MMF, no LC, no DAC)', () => {
    expect(endpointLeg(lib, d, leg('a', 'osfp/1', 1))?.label).toBe('400G DR4 MPO-12F');
    const ids = applicableCables(lib, d, [leg('a', 'osfp/1', 1)], [leg('b', 'osfp/1', 1)]).map((c) => c.id);
    expect(ids).toContain('mpo12-smf');
    expect(ids).not.toContain('mpo12-mmf');
    expect(ids).not.toContain('lc-smf');
    expect(ids.some((id) => id.startsWith('dac'))).toBe(false);
  });
  it('RJ45 to RJ45 offers Cat6A only', () => {
    expect(applicableCables(lib, d, [leg('m', 'rj45/1')], [leg('m', 'rj45/2')]).map((c) => c.id)).toEqual(['cat6a']);
  });
  it('a breakout is offered either way round (LC side selected first runs reversed)', () => {
    const lcSw = lib.devices.get('switch-48x25g-8x100g')!;
    expect(lcSw).toBeTruthy();
    const d2 = newDesign('d2', 'D2', 'network-42ru-600');
    d2.placements.push(
      { ...newPlacement('a', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }), breakoutProfileId: 'all-2x400g' },
      { ...newPlacement('s', 'switch-48x25g-8x100g', 'L1', { kind: 'rack', position: 5, face: 'front' }),
        groupSettings: { sfp28: { reach: 'LR' } } },
    );
    const lc = [1, 2, 3, 4].map((i) => leg('s', `sfp28/${i}`));
    expect(lc.map((e) => endpointLeg(lib, d2, e)?.label)).toEqual(Array(4).fill('25G LR LC'));
    const plan = planCable(lib, d2, lc, [leg('a', 'osfp/1', 1)], 'mpo12-4xlc-smf-breakout', 'left');
    expect(plan.error).toBeUndefined();
    expect(plan.reversed).toBe(true);
    expect(plan.runs[0].from[0].placementId).toBe('a');
    expect(plan.runs[0].to).toHaveLength(4);
  });
});
