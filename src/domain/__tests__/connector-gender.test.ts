import { describe, expect, it } from 'vitest';
import { genderedConnector } from '../optics/connectors';
import { describeEnd } from '../optics/fiber-map';

describe('connector gender in names', () => {
  it('multi-fiber connectors get M (male, pinned) or F (female, unpinned)', () => {
    expect(genderedConnector('MMC-16', 'female')).toBe('MMC-16F');
    expect(genderedConnector('MMC-16', 'male')).toBe('MMC-16M');
    expect(genderedConnector('MPO-8', 'male')).toBe('MPO-8M');
  });
  it('duplex connectors and unknown gender stay unchanged', () => {
    expect(genderedConnector('LC', 'female')).toBe('LC');
    expect(genderedConnector('MPO-12')).toBe('MPO-12');
  });
  it('end descriptions use the gendered name', () => {
    expect(describeEnd({ count: 20, connector: 'MPO-8', gender: 'male' })).toBe('20x MPO-8M');
  });
});
