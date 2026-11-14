import { describe, expect, it } from 'vitest';
import { abbrFromName, abbrProblem, cleanAbbr } from '../design/abbr';
import { newDesign } from '../design/factory';
import { normalizeProject } from '../project/serializer';

describe('rack design abbreviation', () => {
  it('cleans input to at most 4 upper-case letters/digits', () => {
    expect(cleanAbbr('gpu-x1 rack')).toBe('GPUX');
    expect(cleanAbbr('t0')).toBe('T0');
  });
  it('derives from the name', () => {
    expect(abbrFromName('GPU Compute Rack')).toBe('GC');
    expect(abbrFromName('Network')).toBe('NETW');
    expect(abbrFromName('T0 Spine 2')).toBe('TS2');
    expect(abbrFromName('New rack design')).toBe('R');
  });
  it('validates', () => {
    expect(abbrProblem('')).toBeTruthy();
    expect(abbrProblem('ABCDE')).toBeTruthy();
    expect(abbrProblem('CDU')).toBeUndefined();
  });
  it('new designs get one; old project designs are migrated', () => {
    expect(newDesign('d', 'Power Rack', 'x').abbr).toBe('POWE');
    expect(newDesign('d', 'Power Rack', 'x', 'pwr').abbr).toBe('PWR');
    const p = normalizeProject({ rackDesigns: [{ id: 'd', name: 'Storage Rack', templateId: 'x', placements: [], cables: [] }] });
    expect(p.rackDesigns[0].abbr).toBe('STOR');
  });
});
