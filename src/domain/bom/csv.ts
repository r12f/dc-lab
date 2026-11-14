import type { PropertyDef } from '../properties/types';
import type { BomLine } from './types';
import { bomColumns } from './columns';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function bomToCsv(lines: BomLine[], defs: readonly PropertyDef[] = []): string {
  const cols = bomColumns(defs, true);
  const rows = [cols.map((c) => c.header), ...lines.map((l) => cols.map((c) => c.cell(l)))];
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}
