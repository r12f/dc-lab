import { describe, expect, it } from 'vitest';
import { unitsIn } from '../units';

describe('unitsIn', () => {
  it('converts between RU and OU', () => {
    expect(unitsIn({ units: 2, system: 'RU' }, 'RU')).toBe(2);
    expect(unitsIn({ units: 1, system: 'OU' }, 'RU')).toBe(2);
    expect(unitsIn({ units: 1, system: 'RU' }, 'OU')).toBe(1);
    expect(unitsIn({ units: 0, system: 'RU' }, 'OU')).toBe(0);
  });
});
