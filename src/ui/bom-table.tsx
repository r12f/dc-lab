import type { BomLine } from '../domain/bom/types';
import { bomColumns } from '../domain/bom/columns';
import { bomToCsv } from '../domain/bom/csv';
import { formatPower } from '../domain/units';
import { downloadText } from '../io/download';
import { useAppStore } from '../state/store';
import { Button } from './button';
import type { ItemVariant } from '../domain/items/types';
import { GENERIC_SUFFIX } from '../domain/items/types';
import { variantLabel } from '../domain/items/variants';

export function BomTable({ lines, filename, itemsOf, onPick }: {
  lines: BomLine[]; filename: string;
  /** Items of an item type; with `onPick`, lines carrying a pick key get a Vendor / Model (PN) picker. */
  itemsOf?(itemTypeId: string): ItemVariant[];
  onPick?(pickKey: string, itemId: string | undefined): void;
}) {
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
                if (c.header === 'Vendor / Model (PN)' && onPick && itemsOf && l.itemTypeId && l.pickKey) {
                  const key = l.pickKey;
                  return (
                    <td key={c.header}>
                      <select className="bom-pick" value={l.itemId ?? ''} title="Item (vendor / PN) bought for this line"
                        onChange={(e) => onPick(key, e.target.value.endsWith(GENERIC_SUFFIX) ? undefined : e.target.value)}>
                        {itemsOf(l.itemTypeId).map((x) => <option key={x.id} value={x.id}>{x.id.endsWith(GENERIC_SUFFIX) ? 'Generic' : variantLabel(x) || x.id}</option>)}
                      </select>
                    </td>
                  );
                }
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
