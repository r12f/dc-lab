import { useState } from 'react';
import type { BomNode } from '../domain/bom/rack-bom-tree';
import { bomColumns } from '../domain/bom/columns';
import { bomTreeToCsv } from '../domain/bom/csv';
import { formatPower } from '../domain/units';
import { downloadText } from '../io/download';
import { useAppStore } from '../state/store';
import { Button } from './button';
import type { ItemVariant } from '../domain/items/types';
import { variantLabel } from '../domain/items/variants';
import { GENERIC_SUFFIX } from '../domain/items/types';

interface Props {
  root: BomNode;
  filename: string;
  /** Items (vendor products) of an item type; with `onPick`, each line's Vendor / Model (PN) becomes a picker. */
  itemsOf?(itemTypeId: string): ItemVariant[];
  /** Picks the item for a line (undefined = Generic). */
  onPick?(pickKey: string, itemId: string | undefined): void;
}

/** BOM as an expandable tree table: the first column is indented by depth, groups collapse. */
export function BomTreeTable({ root, filename, itemsOf, onPick }: Props) {
  const defs = useAppStore((s) => s.project.propertyDefs);
  const cols = bomColumns(defs);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const rows: { node: BomNode; depth: number }[] = [];
  const walk = (n: BomNode, depth: number) => {
    rows.push({ node: n, depth });
    if (!closed.has(n.key)) n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);

  return (
    <div className="table-scroll">
      <table className="table bom-tree">
        <thead>
          <tr>{cols.map((c) => <th key={c.header} className={c.numeric ? 'num' : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth }) => {
            const l = node.line;
            const caret = node.children.length ? (closed.has(node.key) ? '▸' : '▾') : '';
            return (
              <tr key={node.key} className={l ? undefined : 'group'} title={l?.notes.join(', ')}>
                {cols.map((c, i) => {
                  if (i === 0) {
                    return (
                      <td key={c.header} style={{ paddingLeft: 4 + depth * 14 }}>
                        <span className="caret" onClick={() => node.children.length && toggle(node.key)}
                          style={{ cursor: node.children.length ? 'pointer' : undefined }}>{caret}</span>{' '}
                        {node.label}
                        {!l && node.children.length === 0 && <span className="muted"> — empty</span>}
                      </td>
                    );
                  }
                  if (!l) return <td key={c.header} />;
                  if (c.header === 'Vendor / Model (PN)' && onPick && itemsOf && l.itemTypeId && l.pickKey) {
                    const items = itemsOf(l.itemTypeId);
                    const key = l.pickKey;
                    return (
                      <td key={c.header}>
                        <select className="bom-pick" value={l.itemId ?? ''} title="Item (vendor / PN) bought for this line"
                          onChange={(e) => onPick(key, e.target.value.endsWith(GENERIC_SUFFIX) ? undefined : e.target.value)}>
                          {items.map((v) => <option key={v.id} value={v.id}>{v.id.endsWith(GENERIC_SUFFIX) ? 'Generic' : variantLabel(v) || v.id}</option>)}
                        </select>
                      </td>
                    );
                  }
                  const v = c.cell(l);
                  return <td key={c.header} className={c.numeric ? 'num' : undefined}>{c.header === 'Total W' && typeof v === 'number' ? formatPower(v) : v}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button onClick={() => downloadText(`${filename}-bom.csv`, bomTreeToCsv(root, defs), 'text/csv')}
        title="Tree order with a Level column (rack = 0, rack frame / side elements / cables = 1, …)">Export CSV</Button>
    </div>
  );
}
