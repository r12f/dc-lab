import { describe, expect, it } from 'vitest';
import { groupCols, portCell, portName } from '../device/ports';
import { migrateDevice } from '../project/migrate';
import type { PortGroup } from '../device/types';

const col = (first: number, sub: number): PortGroup => ({ id: 'c', label: 'C', role: 'data', formFactor: 'MPO-8', count: 6 * sub,
  speedGbps: 0, lanes: 8, face: 'front', rows: 6, breakoutModes: [], fill: 'row-major', bottomUp: true, subPorts: sub, firstNumber: first });

describe('cassette port grids', () => {
  it('row-major, bottom up: cassette 1 is the bottom row, its 4 connectors left to right', () => {
    const g = col(1, 4);
    expect(groupCols(g)).toBe(4);
    expect([1, 2, 3, 4, 5].map((i) => portCell(g, i - 1))).toEqual([
      { col: 0, row: 5 }, { col: 1, row: 5 }, { col: 2, row: 5 }, { col: 3, row: 5 }, { col: 0, row: 4 }]);
    expect(portCell(g, 23)).toEqual({ col: 3, row: 0 });
  });
  it('two-level names: 1A..1D, 2A..; columns continue the cassette numbers', () => {
    expect([1, 4, 5, 24].map((i) => portName(col(1, 4), i))).toEqual(['1A', '1D', '2A', '6D']);
    expect([1, 36].map((i) => portName(col(7, 6), i))).toEqual(['7A', '12F']);
    expect(portName({ ...col(1, 1), subPorts: undefined, firstNumber: undefined }, 3)).toBe('3');
  });
  it('legacy port `gender` migrates to cableGender', () => {
    const d = migrateDevice({ id: 'x', ports: [{ id: 'f', formFactor: 'MMC-16', role: 'data', gender: 'male' }], breakoutProfiles: [] });
    expect((d.ports as Record<string, unknown>[])[0]).toMatchObject({ cableGender: 'male' });
    expect((d.ports as Record<string, unknown>[])[0].gender).toBeUndefined();
  });
});
