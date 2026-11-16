import { describe, expect, it } from 'vitest';
import { connectorsMate } from '../optics/connectors';
import { formFactorSpec } from '../ports/form-factors';

describe('C13/C19 combination outlet', () => {
  it('is a power form factor that takes a C14 or a C20 plug', () => {
    expect(formFactorSpec('C13/C19').kind).toBe('power');
    expect([connectorsMate('C13/C19', 'C14'), connectorsMate('C20', 'C13/C19'), connectorsMate('C13/C19', 'C13')]).toEqual([true, true, false]);
    expect([connectorsMate('C13', 'C14'), connectorsMate('C19', 'C14')]).toEqual([true, false]);
  });
});
