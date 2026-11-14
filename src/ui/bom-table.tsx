import type { BomLine } from '../domain/bom/types';
import { bomColumns } from '../domain/bom/columns';
import { bomToCsv } from '../domain/bom/csv';
import { formatPower } from '../domain/units';
import { downloadText } from '../io/download';
import { useAppStore } from '../state/store';
import { Button } from './button';

export function BomTable({ lines, filename }: { lines: BomLine[]; filename: string }) {
  const defs = useAppStore((s) => s.project.propertyDefs);
  const cols = bomColumns(defs);
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>{cols.map((c) => <th key={c.header} className={c.numeric ? 'num' : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} title={l.notes.join(', ')}>
              {cols.map((c) => {
                const v = c.cell(l);
                return <td key={c.header} className={c.numeric ? 'num' : undefined}>{c.header === 'Total W' && typeof v === 'number' ? formatPower(v) : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={() => downloadText(`${filename}-bom.csv`, bomToCsv(lines, defs), 'text/csv')}>Export CSV</Button>
    </div>
  );
}
