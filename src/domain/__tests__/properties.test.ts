import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { buildRackBom } from '../bom/rack-bom';
import { bomToCsv } from '../bom/csv';
import { coerce, formatValue, valueOf } from '../properties/properties';
import type { PropertyDef } from '../properties/types';
import { normalizeProject } from '../project/serializer';

const lead: PropertyDef = { id: 'lead', name: 'Lead time', appliesTo: ['device'], type: 'number', unit: 'weeks', showInBom: true, defaultValue: 8 };
const site: PropertyDef = { id: 'site', name: 'Site', appliesTo: ['rack'], type: 'select', options: ['A', 'B'], showInBom: true };
const hidden: PropertyDef = { id: 'secret', name: 'Internal', appliesTo: ['device'], type: 'text', showInBom: false };

describe('custom properties', () => {
  it('values coerce, default and format', () => {
    expect(coerce(lead, '12')).toBe(12);
    expect(coerce(lead, '')).toBeUndefined();
    expect(valueOf({}, lead)).toBe(8);
    expect(formatValue(lead, 12)).toBe('12 weeks');
    expect(formatValue({ ...hidden, type: 'boolean' }, true)).toBe('Yes');
  });
  it('built-in values come from the project and show in the BOM', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject(), [], {
      'switch-64x800g-osfp': { lead: 20, secret: 'x' }, 'network-42ru-600': { site: 'B' },
    });
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push(newPlacement('p1', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' }));
    d.placements.push(newPlacement('p2', 'server-1u-compute', 'S1', { kind: 'rack', position: 5, face: 'front' }));
    const csv = bomToCsv(buildRackBom(lib, d), [lead, site, hidden]).split('\n');
    expect(csv[0]).toBe('Item,Category,Vendor / Model (PN),Lead time,Site,Qty,SI may adjust,Unit W,Total W,Notes');
    expect(csv.find((l) => l.startsWith('Network Rack'))).toContain(',,B,1,');
    expect(csv.find((l) => l.startsWith('64x800G'))).toContain(',20 weeks,,1,');
    expect(csv.find((l) => l.startsWith('1U Compute'))).toContain(',8 weeks,,1,');
    expect(csv.join()).not.toContain('Internal');
  });
  it('project round-trip keeps definitions and built-in values', () => {
    const p = normalizeProject({ propertyDefs: [lead], builtinProperties: { x: { lead: 3 } } });
    expect(p.propertyDefs).toEqual([lead]);
    expect(p.builtinProperties).toEqual({ x: { lead: 3 } });
  });
});
