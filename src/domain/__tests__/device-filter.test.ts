import { describe, expect, it } from 'vitest';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { visibleCables, visibleDesign } from '../design/device-filter';

describe('cabling view device filter', () => {
  const d = newDesign('d', 'D', 'network-42ru-600');
  d.placements.push(
    newPlacement('a', 'switch-48x1g-mgmt', 'A', { kind: 'rack', position: 1, face: 'front' }),
    newPlacement('b', 'switch-48x1g-mgmt', 'B', { kind: 'rack', position: 2, face: 'front' }),
    newPlacement('c', 'switch-48x1g-mgmt', 'C', { kind: 'rack', position: 3, face: 'front' }),
  );
  const ep = (p: string) => ({ placementId: p, portRef: 'rj45/1' });
  d.cables.push(
    { id: 'ab', from: [ep('a')], to: [ep('b')], route: 'left', mediaId: 'cat6a', quantity: 1 },
    { id: 'bc', from: [ep('b')], to: [ep('c')], route: 'left', mediaId: 'cat6a', quantity: 1 },
  );
  d.crossRack = [ep('c')];

  it('hides devices and every link touching them', () => {
    const v = visibleDesign(d, new Set(['c']));
    expect(v.placements.map((p) => p.id)).toEqual(['a', 'b']);
    expect(v.cables.map((c) => c.id)).toEqual(['ab']);
    expect(v.crossRack).toEqual([]);
  });
  it('nothing hidden -> the same design object (layout cache stays valid)', () => {
    expect(visibleDesign(d, new Set())).toBe(d);
  });
  it('elevation filter keeps every device and drops links touching hidden ones', () => {
    const v = visibleCables(d, new Set(['c']));
    expect(v.placements).toHaveLength(3);
    expect(v.cables.map((c) => c.id)).toEqual(['ab']);
    expect(visibleCables(d, new Set())).toBe(d);
  });
});
