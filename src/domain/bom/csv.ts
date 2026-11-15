import type { PropertyDef } from '../properties/types';
import type { BomLine } from './types';
import { bomColumns } from './columns';
import type { BomNode } from './rack-bom-tree';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Tree BOM as CSV in tree order, with a leading Level column: the root (rack) is 1, its children (rack frame, side
 * elements, in-rack cables) 2, devices in them 3, and so on. Group rows carry only Level and Item.
 */
export function bomTreeToCsv(root: BomNode, defs: readonly PropertyDef[] = []): string {
  const cols = bomColumns(defs, true);
  const rows: (string | number)[][] = [['Level', ...cols.map((c) => c.header)]];
  const walk = (n: BomNode, level: number) => {
    rows.push([level, ...cols.map((c, i) => (n.line ? c.cell(n.line) : i === 0 ? n.label : ''))]);
    n.children.forEach((ch) => walk(ch, level + 1));
  };
  walk(root, 1);
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

export function bomToCsv(lines: BomLine[], defs: readonly PropertyDef[] = []): string {
  const cols = bomColumns(defs, true);
  const rows = [cols.map((c) => c.header), ...lines.map((l) => cols.map((c) => c.cell(l)))];
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}
