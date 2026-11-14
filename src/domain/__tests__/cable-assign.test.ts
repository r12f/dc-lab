import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { placementConnectors, planAssignments, splitSelection } from '../design/cable-assign';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const d = newDesign('d', 'D', 'network-42ru-600');
d.placements.push(
  newPlacement('a', 'switch-32x400g-qsfpdd', 'SW1', { kind: 'rack', position: 1, face: 'front' }),
  newPlacement('b', 'switch-32x400g-qsfpdd', 'SW2', { kind: 'rack', position: 21, face: 'front' }),
  newPlacement('r', 'switch-32x400g-qsfpdd', 'SW3', { kind: 'rack', position: 10, face: 'rear' }),
);

describe('cabling view assignment', () => {
  it('lists connectors per face; a rear-mounted device shows its rear ports from the front', () => {
    const a = placementConnectors(lib, d, d.placements[0], 'front');
    expect(a.length).toBeGreaterThan(0);
    const dev = lib.devices.get('switch-32x400g-qsfpdd')!;
    const rearPorts = dev.ports.filter((g) => g.face === 'rear').reduce((n, g) => n + g.count, 0);
    const front = placementConnectors(lib, d, d.placements[2], 'front');
    expect(front.every((e) => dev.ports.find((g) => e.portRef.startsWith(`${g.id}/`))?.face === 'rear')).toBe(true);
    expect(front.length >= rearPorts).toBe(true);
  });
  it('repeats a cable: 10 A + 10 B connectors with a 1:1 cable = 10 runs paired in order', () => {
    const a = placementConnectors(lib, d, d.placements[0], 'front').slice(0, 10);
    const b = placementConnectors(lib, d, d.placements[1], 'front').slice(0, 10);
    const split = splitSelection([...a, ...b]);
    expect(split.a).toHaveLength(10);
    const plan = planAssignments(lib, d, split.a, split.b, 'lc-smf', 'left');
    expect(plan.error).toBeUndefined();
    expect(plan.runs).toHaveLength(10);
    expect(plan.runs[3].from[0]).toEqual(a[3]);
    expect(plan.runs[3].to[0]).toEqual(b[3]);
  });
  it('rejects mismatched counts and already-used connectors', () => {
    const a = placementConnectors(lib, d, d.placements[0], 'front').slice(0, 3);
    const b = placementConnectors(lib, d, d.placements[1], 'front').slice(0, 2);
    expect(planAssignments(lib, d, a, b, 'lc-smf', 'left').error).toMatch(/3 cable\(s\) on A but 2 on B/);
    const used = { ...d, cables: [{ id: 'c', from: [a[0]], to: [b[0]], route: 'left' as const, mediaId: 'lc-smf', quantity: 1 }] };
    expect(planAssignments(lib, used, a.slice(0, 1), b.slice(0, 1), 'lc-smf', 'left').error).toMatch(/already connected/);
  });
  it('breakout cable groups B ends by its connector count', () => {
    const a = placementConnectors(lib, d, d.placements[0], 'front').slice(0, 2);
    const b = placementConnectors(lib, d, d.placements[1], 'front').slice(0, 8);
    const plan = planAssignments(lib, d, a, b, 'mpo12-4xlc-smf-breakout', 'auto');
    expect(plan.runs).toHaveLength(2);
    expect(plan.runs[1].to).toEqual(b.slice(4, 8));
  });
});
