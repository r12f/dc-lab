import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { cableIssues, endpointLegs } from '../design/connectors';
import { estimateLengthM } from '../design/cabling';
import { normalizeProject } from '../project/serializer';
import { portLabel } from '../device/port-label';
import type { CableRun } from '../design/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const d = newDesign('d', 'D', 'network-42ru-600');
const sw = newPlacement('sw', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' });
sw.groupSettings = { osfp: { mode: '2x400G', reach: '2xDR4' } };
const sv = newPlacement('sv', 'switch-64x800g-osfp', 'SW2', { kind: 'rack', position: 10, face: 'front' });
sv.groupSettings = { osfp: { mode: '2x400G', reach: '2xFR4' } };
d.placements.push(sw, sv);
const ep = (placementId: string, portRef: string, connector?: number) => ({ placementId, portRef, connector });

describe('connector-to-connector cabling', () => {
  it('a 2xDR4 port has two MPO-12 legs', () => {
    expect(endpointLegs(lib, d, 'sw', 'osfp/1')).toEqual({ count: 2, connector: 'MPO-12', cableGender: 'female' });
  });
  it('both legs of one port can carry separate runs; reusing a leg is flagged', () => {
    const r1: CableRun = { id: 'a', from: [ep('sw', 'osfp/1', 1)], to: [ep('sw', 'osfp/2', 1)], route: 'left', mediaId: 'mpo12-smf', quantity: 1 };
    const r2: CableRun = { id: 'b', from: [ep('sw', 'osfp/1', 2)], to: [ep('sw', 'osfp/2', 2)], route: 'left', mediaId: 'mpo12-smf', quantity: 1 };
    const r3: CableRun = { id: 'c', from: [ep('sw', 'osfp/1', 2)], to: [ep('sw', 'osfp/3', 1)], route: 'left', mediaId: 'mpo12-smf', quantity: 1 };
    const design = { ...d, cables: [r1, r2, r3] };
    expect(cableIssues(lib, design, r1)).toEqual([]);
    expect(cableIssues(lib, design, r3)).toContain('SW1 osfp/1.2 is already connected');
  });
  it('breakout MPO-12 -> 4x LC: A must be MPO-12, B legs LC, at most 4', () => {
    const run: CableRun = { id: 'x', from: [ep('sw', 'osfp/1', 1)], mediaId: 'mpo12-4xlc-smf-breakout', route: 'right', quantity: 1,
      to: [ep('sv', 'osfp/1', 1), ep('sv', 'osfp/1', 2), ep('sv', 'osfp/2', 1), ep('sv', 'osfp/2', 2)] };
    expect(cableIssues(lib, { ...d, cables: [run] }, run)).toEqual([]);
    const bad = { ...run, to: [...run.to, ep('sv', 'osfp/3', 1)], from: [ep('sv', 'osfp/4', 1)] };
    const issues = cableIssues(lib, { ...d, cables: [bad] }, bad);
    expect(issues).toContain('A SW2 osfp/4.1 is LC, cable end is MPO-12');
    expect(issues).toContain('5 B ends but cable has 4 B connector(s)');
    expect(estimateLengthM(lib, d, run)).toBeGreaterThan(0);
  });
  it('legacy single `to` becomes a list', () => {
    const p = normalizeProject({ rackDesigns: [{ id: 'd', placements: [], cables: [{ id: 'c', from: ep('a', ''), to: ep('b', '') }] }] });
    expect(p.rackDesigns[0].cables[0].to).toEqual([ep('b', '')]);
    expect(p.rackDesigns[0].cables[0].from).toEqual([ep('a', '')]);
  });
  it('port labels name interface and mode for every port type', () => {
    const g = (formFactor: string, speedGbps: number) => ({ formFactor, speedGbps }) as never;
    expect(portLabel(g('OSFP', 800))).toBe('OSFP 800G');
    expect(portLabel(g('OSFP', 800), '2x400G')).toBe('OSFP 2x400G');
    expect(portLabel(g('RJ45', 1))).toBe('RJ45 1G');
    expect(portLabel(g('C13', 0))).toBe('C13');
    expect(portLabel(g('LC', 0))).toBe('LC');
  });
});
