import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement, placementProblem } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';
import { categoryFolder, isRepeatable, traitsOf } from '../device/categories';
import { DEVICE_TEMPLATES } from '../device/templates';
import { normalizeProject } from '../project/serializer';
import type { Placement } from '../design/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const mgmt = lib.devices.get('switch-48x1g-mgmt')!;
const at = (id: string, deviceId: string, label: string, position: number, units?: number): Placement =>
  ({ ...newPlacement(id, deviceId, label, { kind: 'rack', position, face: 'front' }), ...(units ? { repeat: units } : {}) });

describe('size-adjustable fillers', () => {
  it('blanking / brush panels, stiffeners and empty space: one built-in each, all under Misc', () => {
    for (const c of ['blanking-panel', 'brush-panel', 'stiffener', 'reserved'] as const) {
      expect(isRepeatable({ category: c })).toBe(true);
      expect(categoryFolder(c)).toBe('Misc');
      expect(lib.devices.items().filter((d) => d.category === c).map((d) => d.id)).toEqual([c]);
    }
    expect(categoryFolder('patch-panel')).toBe('Patch / Fiber Housing');
    expect(isRepeatable({ category: 'patch-panel' })).toBe(false);
  });
  it('repeatable is opt-in per device; a filler can be made fixed', () => {
    const sw = { ...lib.devices.get('switch-48x1g-mgmt')!, id: 'sw-var', repeatable: true };
    const bp = { ...lib.devices.get('blanking-panel')!, id: 'bp-fixed', repeatable: false };
    expect(isRepeatable(sw)).toBe(true);
    expect(isRepeatable(bp)).toBe(false);
    const l = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), devices: [sw, bp] });
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('a', 'sw-var', 'SW1', 1, 3), at('b', 'bp-fixed', 'BP1', 4, 3));
    expect(computeRackMetrics(l, d).usedUnits).toBe(3 + 1);
    expect(DEVICE_TEMPLATES.map((t) => t.id)).toEqual(expect.arrayContaining(['blanking-panel', 'stiffener', 'brush-panel', 'reserved']));
  });
  it('fillers take the height set on the placement and the rack unit system (RU and OU racks)', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('b', 'blanking-panel', 'BP1', 1, 3));
    expect(placementProblem(lib, d, mgmt, { kind: 'rack', position: 3, face: 'front' })).toMatch(/Overlaps BP1/);
    expect(placementProblem(lib, d, mgmt, { kind: 'rack', position: 4, face: 'front' })).toBeUndefined();
    // Height scales the filler's own per-unit weight.
    const perUnit = lib.devices.get('blanking-panel')!.weightKg / lib.devices.get('blanking-panel')!.height.units;
    expect(computeRackMetrics(lib, d)).toMatchObject({ usedUnits: 3, typicalW: 0, deviceWeightKg: perUnit * 3 });
    expect(buildRackBom(lib, d).find((l) => l.kind === 'device')).toMatchObject({ item: 'Blanking Panel', category: 'Blanking Panel', qty: 3 });
    const o = newDesign('o', 'O', 'orv3-44ou');
    expect(placementProblem(lib, o, lib.devices.get('stiffener')!, { kind: 'rack', position: 1, face: 'front' })).toBeUndefined();
  });
  it('growing a filler into another device is rejected', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('b', 'blanking-panel', 'BP1', 1), at('s', 'switch-48x1g-mgmt', 'SW1', 3));
    expect(placementProblem(lib, d, lib.devices.get('blanking-panel')!, d.placements[0].mount, 'b', 2)).toBeUndefined();
    expect(placementProblem(lib, d, lib.devices.get('blanking-panel')!, d.placements[0].mount, 'b', 3)).toMatch(/Overlaps SW1/);
  });
  it('repeated fillers are one BOM line counting every copy', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('a', 'brush-panel', 'BR1', 1), at('b', 'brush-panel', 'BR2', 2, 2), at('c', 'brush-panel', 'BR3', 4, 2));
    const lines = buildRackBom(lib, d).filter((l) => l.kind === 'device').map((l) => [l.item, l.qty]);
    expect(lines).toEqual([['Brush Panel', 5]]);
  });
  it('empty (reserved) space holds units but adds no weight, power or BOM line', () => {
    expect(traitsOf('reserved')).toMatchObject({ label: 'Empty (Reserved)', filler: 'reserved' });
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('r', 'reserved', 'RSV1', 10, 4));
    expect(placementProblem(lib, d, mgmt, { kind: 'rack', position: 13, face: 'front' })).toBeTruthy();
    expect(computeRackMetrics(lib, d)).toMatchObject({ usedUnits: 4, typicalW: 0, deviceWeightKg: 0 });
    expect(buildRackBom(lib, d).filter((l) => l.kind === 'device')).toEqual([]);
  });
  it('old fixed-size fillers migrate to the adjustable item with that height', () => {
    const p = normalizeProject({ schema: 'dc-lab/project@1', hiddenBuiltins: ['reserved-1ru', 'reserved-2ru'], rackDesigns: [{ id: 'd', placements: [
      { id: 'a', deviceId: 'reserved-4ru', label: 'RSV1', mount: { kind: 'rack', position: 1, face: 'front' }, portSettings: {}, groupSettings: {} },
      { id: 'b', deviceId: 'stiffener-1ou', label: 'STF1', mount: { kind: 'rack', position: 9, face: 'front' }, portSettings: {}, groupSettings: {} },
    ] }] });
    expect(p.rackDesigns[0].placements.map((x) => [x.deviceId, x.repeat])).toEqual([['reserved', 4], ['stiffener', undefined]]);
    expect(p.hiddenBuiltins).toEqual([]);
  });
  it('a repeatable device: n copies in one placement — n x units, power, weight; BOM qty n', () => {
    const sw = { ...lib.devices.get('switch-48x1g-mgmt')!, id: 'sw-rep', repeatable: true };
    const l = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), devices: [sw] });
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(at('a', 'sw-rep', 'X1', 1, 6));
    expect(computeRackMetrics(l, d)).toMatchObject({ usedUnits: 6, typicalW: sw.power.typicalW * 6, deviceWeightKg: sw.weightKg * 6 });
    expect(buildRackBom(l, d).find((x) => x.kind === 'device')).toMatchObject({ item: sw.name, qty: 6, unitW: sw.power.typicalW });
    expect(placementProblem(l, d, mgmt, { kind: 'rack', position: 6, face: 'front' })).toMatch(/Overlaps X1/);
    // Not repeatable: `repeat` is ignored.
    const f = newDesign('f', 'F', 'network-42ru-600');
    f.placements.push(at('b', 'switch-48x1g-mgmt', 'SW1', 1, 6));
    expect(computeRackMetrics(lib, f).usedUnits).toBe(1);
  });
  it('legacy: device `resizable` -> `repeatable`, placement `units` -> `repeat`', () => {
    const p = normalizeProject({ schema: 'dc-lab/project@1', devices: [{ ...mgmt, id: 'x', resizable: true }], rackDesigns: [{ id: 'd', templateId: 'network-42ru-600', placements: [
      { id: 'a', deviceId: 'blanking-panel', label: 'BP1', units: 3, mount: { kind: 'rack', position: 1, face: 'front' }, portSettings: {}, groupSettings: {} },
    ] }] });
    expect(p.devices[0].repeatable).toBe(true);
    expect(p.rackDesigns[0].placements[0].repeat).toBe(3);
  });
});
