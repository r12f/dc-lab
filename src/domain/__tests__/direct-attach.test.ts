import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { compatibleCables, reachOptions } from '../ports/optic-match';
import { resolvePort } from '../device/port-settings';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';
import { normalizeProject } from '../project/serializer';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const sw = lib.devices.get('switch-64x800g-osfp')!;
const osfp = sw.ports.find((g) => g.id === 'osfp')!;

describe('DAC / AEC / AOC are cables, not optics', () => {
  it('no direct-attach entries among optics; cable types exist', () => {
    expect(lib.optics.items().some((o) => /DAC|AEC|AOC/.test(o.reach))).toBe(false);
    const types = new Set(lib.cableMedia.items().map((c) => c.type));
    for (const t of ['copper-dac', 'aec', 'aoc']) expect(types.has(t as never), t).toBe(true);
  });
  it('an 800G OSFP port offers DAC, AEC and AOC reaches, each with only its own cables', () => {
    expect(reachOptions(lib, osfp, '1x800G')).toEqual(expect.arrayContaining(['DAC', 'AEC', 'AOC']));
    expect(compatibleCables(lib, osfp, undefined, 'AEC', '1x800G').map((c) => c.id)).toEqual(['aec-800g']);
    expect(compatibleCables(lib, osfp, undefined, 'DAC', '1x800G').map((c) => c.id)).toEqual(['dac-800g']);
    // Speed must match: a 400G QSFP-DD port gets the 400G QSFP-DD cables, not the 800G OSFP ones.
    const qdd = lib.devices.get('switch-32x400g-qsfpdd')!.ports.find((g) => g.role === 'data')!;
    expect(compatibleCables(lib, qdd, undefined, 'AOC', '1x400G').map((c) => c.id)).toEqual(['aoc-400g-qsfpdd']);
  });
  it('reach AEC picks no transceiver; fiber cable lists exclude direct-attach cables', () => {
    const r = resolvePort(lib, sw, 'osfp/1', { id: 'p', name: 'p', groupDefaults: { osfp: { reach: 'AEC', cableId: 'aec-800g' } }, overrides: {} });
    expect(r?.optic).toBeUndefined();
    expect(r?.cableId).toBe('aec-800g');
    const dr = lib.optics.get('osfp-800g-2xdr4')!;
    expect(compatibleCables(lib, osfp, dr).some((c) => ['copper-dac', 'aec', 'aoc'].includes(c.type))).toBe(false);
  });
  it('active cable ends add power and a BOM line', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    const p = newPlacement('s', sw.id, 'SW1', { kind: 'rack', position: 1, face: 'front' });
    p.groupSettings = { osfp: { reach: 'AEC', cableId: 'aec-800g' } };
    d.placements.push(p);
    const m = computeRackMetrics(lib, d);
    const aec = lib.cableMedia.get('aec-800g')!;
    expect(m.typicalW).toBe(sw.power.typicalW + 64 * aec.powerWPerEnd!);
    expect(buildRackBom(lib, d).find((l) => l.item === aec.name)).toMatchObject({ qty: 64, unitW: aec.powerWPerEnd });
    expect(buildRackBom(lib, d).some((l) => l.kind === 'optic')).toBe(false);
  });
  it('projects that pinned a DAC "optic" now use reach DAC + the DAC cable', () => {
    const proj = normalizeProject({ rackDesigns: [{ id: 'd', name: 'D', templateId: 'network-42ru-600', cables: [], placements: [
      { id: 's', deviceId: sw.id, label: 'SW1', mount: { kind: 'rack', position: 1, face: 'front' }, portSettings: { 'osfp/1': { opticId: 'osfp-800g-dac' } }, groupSettings: {} },
    ] }] });
    expect(proj.rackDesigns[0].placements[0].portSettings['osfp/1']).toEqual({ reach: 'DAC', cableId: 'dac-800g' });
  });
});
