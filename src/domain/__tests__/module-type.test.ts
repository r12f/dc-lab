import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { moduleType, modulesOfType, pickOptic, reachOptions } from '../ports/optic-match';

const lib = new Library(SHIPPED_CATALOG, emptyProject());
const group = (deviceId: string, groupId: string) => lib.devices.get(deviceId)!.ports.find((g) => g.id === groupId)!;

describe('module type -> modules', () => {
  it('variants share a type; PSM4 is DR4; 2xDR4+ is 2xDR4', () => {
    expect(['2xDR4', '2xDR4 LPO', '2xDR4-2', '2xDR4+'].map(moduleType)).toEqual(['2xDR4', '2xDR4', '2xDR4', '2xDR4']);
    expect(['DR4-2', 'PSM4', 'DR4'].map(moduleType)).toEqual(['DR4', 'DR4', 'DR4']);
  });
  it('QSFP-DD port takes QSFP56 / QSFP28 modules of the type at <= port speed; DR4 includes 100G PSM4', () => {
    const qdd = group('switch-32x400g-qsfpdd', 'qsfpdd');
    const ids = modulesOfType(lib, qdd, 'DR4').map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['qsfpdd-400g-dr4', 'qsfp56-200g-dr4', 'qsfp28-100g-psm4']));
    expect(modulesOfType(lib, qdd, 'DR4').every((o) => o.speedGbps <= 400)).toBe(true);
    expect(modulesOfType(lib, qdd, 'DR4')[0].speedGbps).toBe(400);
  });
  it('QSFP28 port does not take QSFP-DD modules', () => {
    const q28 = group('switch-64x100g-qsfp28', 'qsfp28');
    const all = reachOptions(lib, q28, '1x100G').flatMap((t) => modulesOfType(lib, q28, t));
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((o) => o.formFactor === 'QSFP-DD' || o.speedGbps > 100)).toBe(false);
    expect(modulesOfType(lib, q28, 'PSM4').map((o) => o.id)).toEqual(['qsfp28-100g-psm4']);
    // Named PSM4 on a 100G port, DR4 on faster ones; never "DR4" at 100G.
    expect(reachOptions(lib, q28, '1x100G')).toContain('PSM4');
    expect(reachOptions(lib, q28, '1x100G')).not.toContain('DR4');
    expect(reachOptions(lib, group('switch-32x400g-qsfpdd', 'qsfpdd'), '1x400G')).toContain('DR4');
  });
  it('auto pick: the module of the type at the mode speed; a pinned slower one of the type is kept', () => {
    const qdd = group('switch-32x400g-qsfpdd', 'qsfpdd');
    expect(pickOptic(lib, qdd, '1x400G', 'DR4')?.id).toBe('qsfpdd-400g-dr4');
    expect(pickOptic(lib, qdd, '1x100G', 'DR4')?.id).toBe('qsfp28-100g-psm4');
    expect(pickOptic(lib, qdd, '1x400G', 'DR4', 'qsfp56-200g-dr4')?.id).toBe('qsfp56-200g-dr4');
    expect(pickOptic(lib, qdd, '1x400G', 'FR4', 'qsfp56-200g-dr4')?.reach).toBe('FR4');
  });
});

describe('OSFP 2xDR4+ (500 m and 2 km in one module)', () => {
  it('800G / 1.6T are 2xDR4+ with 2 km reach; the separate 2 km module is gone and migrates', async () => {
    const { normalizeProject } = await import('../project/serializer');
    for (const id of ['osfp-800g-2xdr4', 'osfp-1600g-2xdr4']) {
      const o = lib.optics.get(id)!;
      expect([o.reach, o.reachM, o.name.endsWith('2xDR4+')], id).toEqual(['2xDR4+', 2000, true]);
    }
    expect(lib.optics.get('osfp-800g-2xdr4-2km')).toBeUndefined();
    const p = normalizeProject({ rackDesigns: [{ id: 'd', name: 'D', templateId: 'x', cables: [], placements: [
      { id: 'p', deviceId: 'x', label: 'S', mount: { kind: 'rack', position: 1, face: 'front' }, portSettings: {},
        groupSettings: { osfp: { reach: '2xDR4-2', opticId: 'osfp-800g-2xdr4-2km' } } }] }] });
    expect(p.rackDesigns[0].placements[0].groupSettings.osfp).toEqual({ reach: '2xDR4+', opticId: 'osfp-800g-2xdr4' });
  });
  it('2xDR4 picks the plain module, not the pigtail or LPO one', () => {
    const g = group('switch-64x800g-osfp', 'osfp');
    expect(pickOptic(lib, g, '2x400G', '2xDR4')?.id).toBe('osfp-800g-2xdr4');
  });
});
