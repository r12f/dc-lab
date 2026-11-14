import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { cableConnector, compatibleCables } from '../ports/optic-match';
import { resolvePort } from '../device/port-settings';
import { normalizeProject } from '../project/serializer';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { applicableCables } from '../design/cable-assign';

const lib = new Library(SHIPPED_CATALOG, emptyProject());
const sw = lib.devices.get('switch-64x800g-osfp')!;
const at = (reach: string) => resolvePort(lib, sw, 'osfp/1', { id: 'x', name: 'x', groupDefaults: { osfp: { reach } }, overrides: {} })!;

describe('breakout profile: cage + cable connector only', () => {
  it('no module: the connector is the cage form factor, and only DAC / AEC / AOC fit', () => {
    const r = at('');
    expect(r.optic).toBeUndefined();
    expect(cableConnector(r.group, r.optic, r.reach)).toBe('OSFP');
    const cables = compatibleCables(lib, r.group, r.optic, r.reach, r.mode);
    expect(cables.length).toBeGreaterThan(0);
    expect(cables.every((c) => ['copper-dac', 'aec', 'aoc'].includes(c.type) && c.speedGbps === 800)).toBe(true);
  });
  it('with a module: its fiber connector', () => {
    const r = at('2xDR4');
    expect(cableConnector(r.group, r.optic, r.reach)).toBe('MPO-12');
  });
  it('shipped profiles and loaded profiles carry no cable', () => {
    for (const d of SHIPPED_CATALOG.devices) for (const p of d.breakoutProfiles) {
      for (const s of [...Object.values(p.groupDefaults), ...Object.values(p.overrides)]) expect(s.cableId, d.id).toBeUndefined();
    }
    const p = normalizeProject({ devices: [{ id: 'd', ports: [], breakoutProfiles: [{ id: 'a', groupDefaults: { g: { mode: '1x800G', cableId: 'x' } }, overrides: {} }] }] });
    expect(p.devices[0].breakoutProfiles[0].groupDefaults.g).toEqual({ mode: '1x800G' });
  });
});

describe('Rack Designer cabling view on empty cages', () => {
  it('offers exactly the DAC / AEC / AOC that fit the cage and speed', () => {
    const d = newDesign('d', 'D', 'mgx-48ru');
    const place = (id: string, u: number) => ({ ...newPlacement(id, sw.id, id, { kind: 'rack', position: u, face: 'front' }), groupSettings: { osfp: { reach: '' } } });
    d.placements.push(place('a', 1), place('b', 10));
    const ids = applicableCables(lib, d, [{ placementId: 'a', portRef: 'osfp/1' }], [{ placementId: 'b', portRef: 'osfp/1' }]).map((c) => c.id);
    const types = ids.map((id) => lib.cableMedia.get(id)!.type);
    expect(ids.length).toBeGreaterThan(0);
    expect(types.every((t) => ['copper-dac', 'aec', 'aoc'].includes(t))).toBe(true);
  });
});

describe('empty cage connector on the faceplate', () => {
  it('module none: one leg whose connector is the cage form factor (OSFP, QSFP-DD)', async () => {
    const { portLegs } = await import('../ports/legs');
    const r = at('');
    expect(portLegs(r.group, r).map((l) => l.connector)).toEqual(['OSFP']);
    const qdd = lib.devices.get('switch-32x400g-qsfpdd')!;
    const q = resolvePort(lib, qdd, 'qsfpdd/1', { id: 'x', name: 'x', groupDefaults: { qsfpdd: { reach: '' } }, overrides: {} })!;
    expect(portLegs(q.group, q).map((l) => l.connector)).toEqual(['QSFP-DD']);
  });
});
