import { expect, it } from 'vitest';
import { bomTreeToCsv } from '../bom/csv';
import type { BomNode } from '../bom/rack-bom-tree';

const line = (item: string, qty: number) => ({ key: item, kind: 'device' as const, item, category: 'C', vendorModel: 'V', qty, unitW: 0, notes: [] });
it('tree CSV: Level column, rack = 1, groups 2, devices 3', () => {
  const root: BomNode = { key: 'r', label: 'Rack', line: line('Rack', 1), children: [
    { key: 'f', label: 'Rack frame (42U)', children: [{ key: 's', label: 'SW', line: line('SW', 2), children: [{ key: 'o', label: 'Optic', line: line('Optic', 8), children: [] }] }] },
  ] };
  const rows = bomTreeToCsv(root).split('\n').map((r) => r.split(','));
  expect(rows[0].slice(0, 2)).toEqual(['Level', 'Item']);
  expect(rows.slice(1).map((r) => [r[0], r[1]])).toEqual([['1', 'Rack'], ['2', 'Rack frame (42U)'], ['3', 'SW'], ['4', 'Optic']]);
  expect(rows[2].slice(2).every((c) => c === '')).toBe(true);
});
