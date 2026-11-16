import { describe, expect, it } from 'vitest';
import { portCell, portName } from '../device/ports';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';

describe('printed port numbers', () => {
  it('the 80x MMC-16 housing numbers its lone top-left slot 10 (3x3 block 1-9), counting from the module start', () => {
    const d = BUILTIN_CATALOG_FOR_TESTS.devices.find((x) => x.id === 'fiber-housing-80xmmc16')!;
    const [m1, m2] = d.ports;
    const topLeft = Array.from({ length: m1.count }, (_, i) => i + 1).find((n) => { const c = portCell(m1, n - 1); return c.col === 0 && c.row === 0; })!;
    expect(portName(m1, topLeft)).toBe('10');
    expect(portName(m2, topLeft)).toBe('20');
    expect(Array.from({ length: 10 }, (_, i) => portName(m1, i + 1))).toEqual(['1', '2', '3', '4', '5', '6', '10', '7', '8', '9']);
  });
  it('without portNumbers names follow fill order', () => {
    expect(portName({ firstNumber: 11 } as never, 3)).toBe('13');
  });
});
