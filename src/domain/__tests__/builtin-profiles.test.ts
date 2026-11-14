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
  it('resolves to the native mode with a DR module', () => {
    const lib = new Library(SHIPPED_CATALOG, emptyProject());
    const cases: [string, string, string, string][] = [
      ['switch-64x800g-osfp', 'osfp/1', '1x800G', '2xDR4'],
      ['switch-64x1600g-osfp', 'osfp/1', '1x1600G', '2xDR4'],
      ['switch-32x400g-qsfpdd', 'qsfpdd/1', '1x400G', 'DR4'],
      ['switch-64x100g-qsfp28', 'qsfp28/1', '1x100G', 'DR'],
    ];
    for (const [id, ref, mode, reach] of cases) {
      const d = lib.devices.get(id)!;
      const r = resolvePort(lib, d, ref, findProfile(d))!;
      expect([r.mode, r.reach, r.optic?.reach], id).toEqual([mode, reach, reach]);
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
