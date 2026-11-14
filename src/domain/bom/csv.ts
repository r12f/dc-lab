import type { BomLine } from './types';
import { lineTotalW } from './types';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function bomToCsv(lines: BomLine[]): string {
  const header = ['Item', 'Category', 'Vendor/Model', 'Qty', 'Unit W', 'Total W', 'Notes'];
  const rows = lines.map((l) => [l.item, l.category, l.vendorModel, l.qty, l.unitW, lineTotalW(l), l.notes.join(' ')]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
