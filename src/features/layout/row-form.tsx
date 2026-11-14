import type { RowFront, Row } from '../../domain/layout/types';
import { Button } from '../../ui/button';
import { NumberField, SelectField, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';

const facing = [{ value: 'west' as RowFront, label: 'West (left)' }, { value: 'east' as RowFront, label: 'East (right)' }];

export function RowForm({ row, editor, onRemoved }: { row: Row; editor: LayoutEditor; onRemoved(): void }) {
  const set = (patch: Partial<Row>) => editor.updateElement<Row>('rows', row.id, patch);
  return (
    <div className="card">
      <TextField label="Row name" value={row.name} onChange={(name) => set({ name })} />
      <div className="row3">
        <NumberField label="Tiles" value={row.tileCount} min={1} onChange={(tileCount) => set({ tileCount })} />
        <NumberField label="Tile pitch mm" value={row.tileWidthMm} onChange={(tileWidthMm) => set({ tileWidthMm })} />
        <NumberField label="Row depth mm" value={row.tileDepthMm} onChange={(tileDepthMm) => set({ tileDepthMm })} />
      </div>
      <div className="row2">
        <NumberField label="Power budget kW" value={row.powerBudgetKw} onChange={(powerBudgetKw) => set({ powerBudgetKw })} />
        <SelectField<RowFront> label="Front (cold aisle)" value={row.frontFacing} options={facing} onChange={(frontFacing) => set({ frontFacing })} />
      </div>
      <Button variant="danger" onClick={() => { editor.removeElement('rows', row.id); onRemoved(); }}>Remove row</Button>
    </div>
  );
}
