import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { visibleCables, visibleDesign, type ViewFilter } from '../design/device-filter';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const f = (devices: string[] = [], types: string[] = []): ViewFilter => ({ hiddenDevices: new Set(devices), hiddenCableTypes: new Set(types) });

describe('Rack Designer view filters', () => {
  const d = newDesign('d', 'D', 'network-42ru-600');
  d.placements.push(
    newPlacement('a', 'switch-48x1g-mgmt', 'A', { kind: 'rack', position: 1, face: 'front' }),
    newPlacement('b', 'switch-48x1g-mgmt', 'B', { kind: 'rack', position: 2, face: 'front' }),
    newPlacement('c', 'switch-48x1g-mgmt', 'C', { kind: 'rack', position: 3, face: 'front' }),
  );
  const ep = (p: string, i = 1) => ({ placementId: p, portRef: `rj45/${i}` });
  d.cables.push(
    { id: 'ab', from: [ep('a')], to: [ep('b')], route: 'left', mediaId: 'cat6a', quantity: 1 },
    { id: 'bc', from: [ep('b')], to: [ep('c')], route: 'left', mediaId: 'cat6a', quantity: 1 },
    { id: 'pw', from: [ep('a', 2)], to: [ep('b', 2)], route: 'left', mediaId: 'power-c13-c14', quantity: 1 },
  );
  d.crossRack = [ep('c')];

  it('hides devices and every link touching them', () => {
    const v = visibleDesign(lib, d, f(['c']));
    expect(v.placements.map((p) => p.id)).toEqual(['a', 'b']);
    expect(v.cables.map((c) => c.id)).toEqual(['ab', 'pw']);
    expect(v.crossRack).toEqual([]);
  });
  it('nothing hidden -> the same design object (layout cache stays valid)', () => {
    expect(visibleDesign(lib, d, f())).toBe(d);
    expect(visibleCables(lib, d, f())).toBe(d);
  });
  it('elevation filter keeps every device and drops links touching hidden ones', () => {
    const v = visibleCables(lib, d, f(['c']));
    expect(v.placements).toHaveLength(3);
    expect(v.cables.map((c) => c.id)).toEqual(['ab', 'pw']);
  });
  it('a hidden cable type drops its runs in both views', () => {
    expect(visibleCables(lib, d, f([], ['power'])).cables.map((c) => c.id)).toEqual(['ab', 'bc']);
    expect(visibleDesign(lib, d, f([], ['other'])).cables.map((c) => c.id)).toEqual(['pw']);
  });
});
