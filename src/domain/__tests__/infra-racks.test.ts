import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { infraGroups, infraWarnings, servedRacks } from '../layout/infra';
import type { RackDesign } from '../design/types';
import type { DcLayout, RackAssignment, Row } from '../layout/types';
import type { DeviceDefinition } from '../device/types';

// An IT load with a known max power, so the checks are easy to read.
const load: DeviceDefinition = {
  id: 'load-30kw', name: 'Load 30kW', category: 'server', height: { units: 2, system: 'RU' }, depthMm: 800, weightKg: 10,
  power: { typicalW: 25000, maxW: 30000 }, ports: [], breakoutProfiles: [],
};
const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), devices: [load] });
const rackAt = (u: number) => ({ kind: 'rack' as const, position: u, face: 'front' as const });

const it30 = newDesign('it', 'IT', 'mgx-48ru');
it30.placements.push(newPlacement('l', 'load-30kw', 'L1', rackAt(1)));
const pwr = newDesign('pw', 'Power', 'power-rack-48ru');
pwr.placements.push(newPlacement('s', 'power-shelf-mgx-110kw', 'PS1', rackAt(1)), newPlacement('b', 'bbu-shelf-1ru', 'BBU1', rackAt(2)));
const cdu = newDesign('cd', 'CDU', 'cdu-rack-sidecar');
cdu.placements.push(newPlacement('c', 'cdu-in-row-sidecar-110kw', 'CDU1', rackAt(1)));
const all: RackDesign[] = [it30, pwr, cdu];
const designs = (id: string) => all.find((d) => d.id === id);

const row: Row = { id: 'r1', name: 'Row 1', tileCount: 12, tileWidthMm: 600, tileDepthMm: 1200, powerBudgetKw: 1000, frontFacing: 'east' };
const at = (id: string, designId: string, startTile: number, extra: Partial<RackAssignment> = {}): RackAssignment =>
  ({ id, rowId: 'r1', startTile, designId, label: id, ...extra });
const layoutWith = (assignments: RackAssignment[]) => ({ rows: [row], assignments } as unknown as DcLayout);

describe('power / CDU racks', () => {
  it('rack designs: power rack holds a power shelf + BBU, CDU rack one full-height CDU (frame weight 0)', () => {
    const p = computeRackMetrics(lib, pwr);
    expect(p.supplyCapacityW).toBe(109800);
    expect(p.warnings).toEqual([]);
    const c = computeRackMetrics(lib, cdu);
    expect(c.coolingCapacityKw).toBe(110);
    expect(c.usedUnits).toBe(48);
    expect(c.totalUnits).toBe(48);
    expect(c.warnings).toEqual([]);
  });
  it('a sidecar serves the adjacent IT racks on both sides, up to a gap or another sidecar of its kind', () => {
    const l = layoutWith([at('a', 'it', 0), at('b', 'it', 1), at('P', 'pw', 2), at('c', 'it', 3), at('C', 'cd', 4), at('d', 'it', 5), at('e', 'it', 7)]);
    const ids = (x: RackAssignment[]) => x.map((a) => a.id).sort();
    // Power walks past the CDU (other role); stops at the gap before e.
    expect(ids(servedRacks(lib, designs, l, l.assignments[2]))).toEqual(['a', 'b', 'c', 'd']);
    // CDU walks past the power rack.
    expect(ids(servedRacks(lib, designs, l, l.assignments[4]))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('checks supply / cooling against the max power of the served IT racks', () => {
    // 4 IT racks x 30 kW = 120 kW > 109.8 kW supply and > 110 kW cooling.
    const l = layoutWith([at('a', 'it', 0), at('b', 'it', 1), at('P', 'pw', 2), at('C', 'cd', 3), at('c', 'it', 4), at('d', 'it', 5)]);
    const [g] = infraGroups(lib, designs, l, 'power');
    expect(g).toMatchObject({ capacityKw: 109.8, loadKw: 120, ok: false });
    expect(infraWarnings(lib, designs, l).join('\n')).toMatch(/P: supply 109\.80 kW < 120\.00 kW max of a, b, c, d/);
    expect(infraWarnings(lib, designs, l).join('\n')).toMatch(/C: cooling 110\.00 kW < 120\.00 kW/);
    // 3 IT racks = 90 kW: both fine.
    const ok = layoutWith([at('a', 'it', 0), at('P', 'pw', 1), at('C', 'cd', 2), at('c', 'it', 3), at('d', 'it', 4)]);
    expect(infraWarnings(lib, designs, ok)).toEqual([]);
  });
  it('sidecars serving a common IT rack are pooled; explicit serves overrides adjacency', () => {
    // Separated by a gap: two groups. Back to back around the same IT racks: one pooled group.
    const apart = layoutWith([at('P1', 'pw', 0), at('a', 'it', 1), at('b', 'it', 3), at('P2', 'pw', 4)]);
    expect(infraGroups(lib, designs, apart, 'power').map((g) => g.itIds)).toEqual([['a'], ['b']]);
    const around = layoutWith([at('P1', 'pw', 0), at('a', 'it', 1), at('b', 'it', 2), at('P2', 'pw', 3)]);
    expect(infraGroups(lib, designs, around, 'power')).toHaveLength(1);
    const shared = layoutWith([at('P1', 'pw', 0, { serves: ['a', 'b'] }), at('a', 'it', 1), at('b', 'it', 2), at('P2', 'pw', 3, { serves: ['b'] })]);
    const [g] = infraGroups(lib, designs, shared, 'power');
    expect(g).toMatchObject({ infraIds: ['P1', 'P2'], itIds: ['a', 'b'], capacityKw: 219.6, loadKw: 60, ok: true });
  });
  it('a sidecar with nothing next to it is flagged', () => {
    expect(infraWarnings(lib, designs, layoutWith([at('C', 'cd', 0)]))).toEqual(['C: serves no IT rack']);
  });
});
