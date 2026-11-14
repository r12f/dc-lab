import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { fitsRackUnits, newPlacement, placementProblem, spanOf } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBomTree, treeLines } from '../bom/rack-bom-tree';
import { buildRackBom } from '../bom/rack-bom';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const dev = (id: string) => lib.devices.get(id)!;
const rack = (id: string) => lib.racks.get(id)!;

describe('unit systems', () => {
  it('RU racks take RU and 0U devices, not OU ones (and vice versa)', () => {
    expect(fitsRackUnits(dev('switch-48x1g-mgmt'), rack('network-42ru-600'))).toBe(true);
    expect(fitsRackUnits(dev('power-shelf-33kw-ou'), rack('network-42ru-600'))).toBe(false);
    expect(fitsRackUnits(dev('power-shelf-33kw-ou'), rack('orv3-44ou'))).toBe(true);
    expect(fitsRackUnits(dev('switch-48x1g-mgmt'), rack('orv3-44ou'))).toBe(false);
    // Size-adjustable fillers take the rack's unit system.
    expect(fitsRackUnits(dev('blanking-panel'), rack('orv3-44ou'))).toBe(true);
    const d = newDesign('d', 'D', 'network-42ru-600');
    expect(placementProblem(lib, d, dev('power-shelf-33kw-ou'), { kind: 'rack', position: 1, face: 'front' })).toBe('OU device does not fit a RU rack');
  });
  it('a 1RU blanking panel takes exactly 1 unit', () => {
    const r = rack('network-42ru-600');
    expect(spanOf(dev('blanking-panel'), r, { kind: 'rack', position: 5, face: 'front' })).toMatchObject({ bottom: 5, top: 5 });
    const d = newDesign('d', 'D', r.id);
    d.placements.push(newPlacement('b', 'blanking-panel', 'BP1', { kind: 'rack', position: 5, face: 'front' }));
    expect(computeRackMetrics(lib, d).usedUnits).toBe(1);
  });
  it('an 8RU GPU server fits an empty 42RU rack at the top', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    expect(placementProblem(lib, d, dev('server-gpu-8u'), { kind: 'rack', position: 35, face: 'front' })).toBeUndefined();
    expect(placementProblem(lib, d, dev('server-gpu-8u'), { kind: 'rack', position: 36, face: 'front' })).toMatch(/Does not fit/);
  });
});

describe('rack BOM tree', () => {
  it('Rack -> Rack frame / side elements / in-rack cables, devices with their optics', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('s1', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }));
    d.placements.push(newPlacement('s2', 'switch-64x800g-osfp', 'SW2', { kind: 'rack', position: 3, face: 'front' }));
    d.placements.push(newPlacement('r', 'reserved-2ru', 'RSV1', { kind: 'rack', position: 10, face: 'front' }));
    d.placements.push(newPlacement('p', 'pdu-vertical-3ph', 'PDU1', { kind: 'side', elementId: 'pdu-bay-l', slot: 1 }));
    const t = buildRackBomTree(lib, d)!;
    expect(t.label).toBe('Network Rack 42RU');
    expect(t.children.map((c) => c.label)).toEqual([
      'Rack frame (42RU)', 'PDU bay L (PDU bay)', 'Sidepod L (Sidepod)', 'PDU bay R (PDU bay)', 'Sidepod R (Sidepod)',
    ]);
    const frame = t.children[0];
    expect(frame.children.map((c) => [c.label, c.line?.qty, c.line?.notes])).toEqual([['64x800G OSFP Switch', 2, ['SW1', 'SW2']]]);
    expect(t.children[1].children.map((c) => c.label)).toEqual([lib.devices.get('pdu-vertical-3ph')!.name]);
    // Same totals as the flat BOM.
    const sum = (ls: { kind: string; qty: number }[], k: string) => ls.filter((l) => l.kind === k).reduce((n, l) => n + l.qty, 0);
    const flat = buildRackBom(lib, d);
    for (const k of ['device', 'optic', 'cable']) expect(sum(treeLines(t), k), k).toBe(sum(flat, k));
  });
});
