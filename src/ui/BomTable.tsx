import type { BomLine } from '../domain/bom/types';
import { lineTotalW } from '../domain/bom/types';
import { bomToCsv } from '../domain/bom/csv';
import { downloadText } from '../io/download';
import { Button } from './Button';
import { formatPower } from '../domain/units';

export function BomTable({ lines, filename }: { lines: BomLine[]; filename: string }) {
  return (
    <div>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th><th>Category</th><th>Vendor/Model</th><th className="num">Qty</th><th className="num">Total W</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} title={l.notes.join(', ')}>
              <td>{l.item}</td>
              <td>{l.category}</td>
              <td>{l.vendorModel}</td>
              <td className="num">{l.qty}</td>
              <td className="num">{l.unitW ? formatPower(lineTotalW(l)) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={() => downloadText(`${filename}-bom.csv`, bomToCsv(lines), 'text/csv')}>Export CSV</Button>
    </div>
  );
}
