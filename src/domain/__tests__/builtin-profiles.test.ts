import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject, type Project } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS, SHIPPED_CATALOG } from './catalog-fixture';
import { findProfile } from '../device/breakout';
import { resolvePort } from '../device/port-settings';
import { normalizeProject } from '../project/serializer';

describe('default profile: native (max) speed, DR optics', () => {
  it('every shipped device defaults to "default"', () => {
    for (const d of SHIPPED_CATALOG.devices) expect(d.defaultProfileId, d.id).toBe('default');
  });
  it('switches: max speed, no module (empty cage, connector = form factor)', () => {
    const lib = new Library(SHIPPED_CATALOG, emptyProject());
    const cases: [string, string, string][] = [
      ['switch-64x800g-osfp', 'osfp/1', '1x800G'],
      ['switch-64x1600g-osfp', 'osfp/1', '1x1600G'],
      ['switch-32x400g-qsfpdd', 'qsfpdd/1', '1x400G'],
      ['switch-64x100g-qsfp28', 'qsfp28/1', '1x100G'],
    ];
    for (const [id, ref, mode] of cases) {
      const d = lib.devices.get(id)!;
      const r = resolvePort(lib, d, ref, findProfile(d))!;
      expect([r.mode, r.reach, r.optic], id).toEqual([mode, undefined, undefined]);
    }
    for (const d of SHIPPED_CATALOG.devices.filter((x) => x.category === 'switch')) {
      const p = findProfile(d)!;
      expect([p.groupDefaults, p.overrides], d.id).toEqual([{}, {}]);
    }
  });
});

describe('breakout profiles of built-in devices', () => {
  it('project edits replace the built-in list; the device stays built-in', () => {
    const project: Project = { ...emptyProject(), builtinProfiles: {
      'switch-32x400g-qsfpdd': { breakoutProfiles: [{ id: 'default', name: 'Default', groupDefaults: {}, overrides: {} }, { id: 'p4', name: '4x100G', groupDefaults: { qsfpdd: { mode: '4x100G' } }, overrides: {} }], defaultProfileId: 'p4' },
    } };
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, project, [], {}, project.builtinProfiles);
    const d = lib.devices.get('switch-32x400g-qsfpdd')!;
    expect(lib.devices.sourceOf(d.id)).toBe('builtin');
    expect(d.breakoutProfiles.map((p) => p.id)).toEqual(['default', 'p4']);
    expect(findProfile(d)?.id).toBe('p4');
  });
  it('survive save / load', () => {
    const p = normalizeProject({ builtinProfiles: { x: { breakoutProfiles: [], defaultProfileId: 'a' } } });
    expect(p.builtinProfiles.x.defaultProfileId).toBe('a');
    expect(normalizeProject({}).builtinProfiles).toEqual({});
  });
});

describe('default profiles never land on duplex LC', () => {
  it('every DR-class default resolves to an MPO module', () => {
    const lib = new Library(SHIPPED_CATALOG, emptyProject());
    for (const d of lib.devices.items()) {
      const p = findProfile(d);
      for (const g of d.ports) {
        if (!p?.groupDefaults[g.id]?.reach) continue;
        const r = resolvePort(lib, d, `${g.id}/1`, p)!;
        expect(r.optic?.fiberConnector, `${d.id} ${g.id}`).toMatch(/MPO/);
      }
    }
  });
});

describe('100G QSFP28: PSM4 = MPO-12 (default), DR1 = duplex LC', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());
  const sw = lib.devices.get('switch-64x100g-qsfp28')!;
  const at = (reach: string) => resolvePort(lib, sw, 'qsfp28/1', { id: 'x', name: 'x', groupDefaults: { qsfp28: { reach } }, overrides: {} })!.optic;
  it('connectors follow the reach', () => {
    expect(at('PSM4')?.fiberConnector).toBe('MPO-12');
    expect(at('DR1')?.fiberConnector).toBe('LC');
  });
  it('old DR settings load as DR1; PSM4 stays PSM4', () => {
    const p = normalizeProject({ rackDesigns: [{ id: 'd', name: 'D', templateId: 'x', placements: [
      { id: 'p', deviceId: 'switch-64x100g-qsfp28', label: 'S', mount: { kind: 'rack', position: 1, face: 'front' },
        portSettings: { 'qsfp28/1': { reach: 'DR' } }, groupSettings: { qsfp28: { reach: 'PSM4' } } },
    ], cables: [] }] });
    const pl = p.rackDesigns[0].placements[0];
    expect([pl.portSettings['qsfp28/1'].reach, pl.groupSettings.qsfp28.reach]).toEqual(['DR1', 'PSM4']);
  });
});
