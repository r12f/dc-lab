import type { Aisle, CableTray, Rect } from '../../domain/layout/types';
import { Button } from '../../ui/Button';
import { NumberField, SelectField } from '../../ui/fields';
import type { LayoutEditor } from './useLayoutEditor';

function RectFields({ rect, onChange }: { rect: Rect; onChange(patch: Partial<Rect>): void }) {
  return (
    <>
      <div className="row2">
        <NumberField label="X mm" value={rect.x} onChange={(x) => onChange({ x })} />
        <NumberField label="Y mm" value={rect.y} onChange={(y) => onChange({ y })} />
      </div>
      <div className="row2">
        <NumberField label="Width mm" value={rect.widthMm} onChange={(widthMm) => onChange({ widthMm })} />
        <NumberField label="Depth mm" value={rect.depthMm} onChange={(depthMm) => onChange({ depthMm })} />
      </div>
    </>
  );
}

export function AisleForm({ aisle, editor, onRemoved }: { aisle: Aisle; editor: LayoutEditor; onRemoved(): void }) {
  const set = (patch: Partial<Aisle>) => editor.updateElement<Aisle>('aisles', aisle.id, patch);
  return (
    <div className="card">
      <SelectField<Aisle['kind']> label="Aisle" value={aisle.kind}
        options={[{ value: 'cold', label: 'Cold' }, { value: 'hot', label: 'Hot' }]} onChange={(kind) => set({ kind })} />
      <RectFields rect={aisle} onChange={set} />
      <Button variant="danger" onClick={() => { editor.removeElement('aisles', aisle.id); onRemoved(); }}>Remove aisle</Button>
    </div>
  );
}

export function TrayForm({ tray, editor, onRemoved }: { tray: CableTray; editor: LayoutEditor; onRemoved(): void }) {
  const set = (patch: Partial<CableTray>) => editor.updateElement<CableTray>('trays', tray.id, patch);
  return (
    <div className="card">
      <SelectField<CableTray['kind']> label="Tray" value={tray.kind}
        options={[{ value: 'data', label: 'Data' }, { value: 'power', label: 'Power' }]} onChange={(kind) => set({ kind })} />
      <RectFields rect={tray} onChange={set} />
      <Button variant="danger" onClick={() => { editor.removeElement('trays', tray.id); onRemoved(); }}>Remove tray</Button>
    </div>
  );
}
