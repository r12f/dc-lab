import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement, placementProblem } from '../design/placement';
import { computeRackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';
import { traitsOf } from '../device/categories';
import { DEVICE_TEMPLATES } from '../device/templates';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('blanking panels and stiffeners', () => {
  it('are filler categories with built-ins and templates', () => {
    expect(traitsOf('blanking-panel').filler).toBe('blanking');
    expect(traitsOf('stiffener').filler).toBe('stiffener');
    expect(lib.devices.get('blanking-panel-1ru')?.ports).toEqual([]);
    expect(DEVICE_TEMPLATES.map((t) => t.id)).toEqual(expect.arrayContaining(['blanking-panel', 'stiffener']));
  });
  it('occupy units, add weight and BOM lines, no power', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('b', 'blanking-panel-2ru', 'BP1', { kind: 'rack', position: 1, face: 'front' }));
    expect(placementProblem(lib, d, lib.devices.get('switch-48x1g-mgmt')!, { kind: 'rack', position: 2, face: 'front' })).toBeTruthy();
    const m = computeRackMetrics(lib, d);
    expect(m.usedUnits).toBe(2);
    expect(m.typicalW).toBe(0);
    expect(buildRackBom(lib, d).find((l) => l.kind === 'device')).toMatchObject({ item: '2RU Blanking Panel', category: 'Blanking Panel', qty: 1 });
  });
});
