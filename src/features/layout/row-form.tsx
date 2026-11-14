import type { RowFront, Row } from '../../domain/layout/types';
import type { LayoutEditor } from './use-layout-editor';
import { BatchNumber, BatchSelect, BatchText, common } from './batch-fields';

const facing: { value: RowFront; label: string }[] = [{ value: 'west', label: 'West (left)' }, { value: 'east', label: 'East (right)' }];

/** Edits one or several rows; a field changed here is applied to every selected row. */
export function RowForm({ rows, editor }: { rows: Row[]; editor: LayoutEditor }) {
  const set = (patch: Partial<Row>) => editor.updateElements<Row>('rows', rows.map((r) => r.id), patch);
  return (
    <>
      {rows.length === 1 && <BatchText label="Row name" value={rows[0].name} onChange={(name) => set({ name })} />}
      <div className="row3">
        <BatchNumber label="Tiles" value={common(rows, 'tileCount')} min={1} onChange={(tileCount) => set({ tileCount })} />
        <BatchNumber label="Tile pitch mm" value={common(rows, 'tileWidthMm')} onChange={(tileWidthMm) => set({ tileWidthMm })} />
        <BatchNumber label="Row depth mm" value={common(rows, 'tileDepthMm')} onChange={(tileDepthMm) => set({ tileDepthMm })} />
      </div>
      <div className="row2">
        <BatchNumber label="Power budget kW" value={common(rows, 'powerBudgetKw')} onChange={(powerBudgetKw) => set({ powerBudgetKw })} />
        <BatchSelect<RowFront> label="Front (cold aisle)" value={common(rows, 'frontFacing')} options={facing} onChange={(frontFacing) => set({ frontFacing })} />
      </div>
    </>
  );
}
