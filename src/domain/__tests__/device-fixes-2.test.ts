import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS, SHIPPED_CATALOG } from './catalog-fixture';
import { findProfile } from '../device/breakout';
import { normalizeProject } from '../project/serializer';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';

describe('default breakout profile', () => {
  it('every shipped device has one, and it is used when nothing is picked', () => {
    for (const d of SHIPPED_CATALOG.devices) {
      expect(d.defaultProfileId, d.id).toBeTruthy();
      expect(d.breakoutProfiles.some((p) => p.id === d.defaultProfileId), d.id).toBe(true);
    }
    const sw = SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x800g-osfp')!;
    expect(findProfile(sw)?.id).toBe('default');
    expect(findProfile(sw, 'all-2x400g')?.id).toBe('all-2x400g');
    expect(findProfile(sw, 'mixed')?.id).toBe('mixed');
  });
  it('project devices without one get a "Default" profile on load', () => {
    const p = normalizeProject({ devices: [{ id: 'x', ports: [], breakoutProfiles: [{ id: 'a', groupDefaults: {}, overrides: {} }] }] });
    expect(p.devices[0].defaultProfileId).toBe('default');
    expect(p.devices[0].breakoutProfiles.map((b) => b.id)).toEqual(['a', 'default']);
  });
});

describe('catalog cleanups', () => {
  it('no BBU shelf; the 1.6T switch is named as liquid-cooled', () => {
    expect(SHIPPED_CATALOG.devices.some((d) => /bbu/i.test(`${d.id} ${d.name}`))).toBe(false);
    expect(SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x1600g-osfp')!.name).toMatch(/LC Switch/);
  });
});

describe('item power / weight overrides', () => {
  it('an item overrides the item type where set and inherits the rest', () => {
    const project = { ...emptyProject(), variants: [
      { id: 'sw-a', name: 'A', target: 'device' as const, itemId: 'switch-48x1g-mgmt', vendor: 'V', model: 'A', specs: { typicalW: 150, weightKg: 5 } },
    ] };
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, project);
    const base = lib.devices.get('switch-48x1g-mgmt')!;
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('p', base.id, 'M1', { kind: 'rack', position: 1, face: 'front' }));
    d.placements.push(newPlacement('q', base.id, 'M2', { kind: 'rack', position: 2, face: 'front' }));
    const generic = computeRackMetrics(lib, d);
    expect(generic.typicalW).toBe(2 * base.power.typicalW);
    const m = computeRackMetrics(lib, { ...d, bomItems: { [base.id]: 'sw-a' } });
    expect(m.typicalW).toBe(2 * 150);
    expect(m.maxW).toBe(2 * base.power.maxW);
    expect(m.deviceWeightKg).toBeCloseTo(2 * 5);
    expect(buildRackBom(lib, { ...d, bomItems: { [base.id]: 'sw-a' } }).filter((l) => l.kind === 'device').map((l) => [l.unitW, l.qty])).toEqual([[150, 2]]);
  });
});
