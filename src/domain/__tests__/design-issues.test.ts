import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { designIssues } from '../design/issues';

// The catalog carries no power figures: a heavy test load pushes the rack over its rating.
const load = { ...BUILTIN_CATALOG_FOR_TESTS.devices.find((d) => d.id === 'server-gpu-8u')!, id: 'load-8u', power: { typicalW: 9000, maxW: 12000 } };
const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, { ...emptyProject(), devices: [load] });

describe('design issues for marking the rack', () => {
  it('attaches overlaps / unit-system errors to placements and power errors to the rack', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('a', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }));
    d.placements.push(newPlacement('b', 'switch-64x800g-osfp', 'SW2', { kind: 'rack', position: 2, face: 'front' }));
    d.placements.push(newPlacement('c', 'power-shelf-33kw-ou', 'PS1', { kind: 'rack', position: 20, face: 'front' }));
    for (let i = 0; i < 4; i++) d.placements.push(newPlacement(`g${i}`, 'load-8u', `GPU${i}`, { kind: 'rack', position: 22 + i * 5, face: 'front' }));
    const x = designIssues(lib, d);
    // Both devices of an overlap are marked.
    expect(x.placements.get('a')?.[0]).toMatch(/Overlaps SW2/);
    expect(x.placements.get('b')?.[0]).toMatch(/Overlaps SW1/);
    expect(x.placements.get('c')?.[0]).toMatch(/OU device does not fit a RU rack/);
    expect(x.rack.some((w) => /exceeds rack rating/.test(w))).toBe(true);
    expect(x.rack.some((w) => w.startsWith('SW2:'))).toBe(false);
    expect(x.count).toBeGreaterThanOrEqual(3);
  });
  it('a clean design has no issues', () => {
    expect(designIssues(lib, newDesign('d', 'D', 'network-42ru-600')).count).toBe(0);
  });
});
