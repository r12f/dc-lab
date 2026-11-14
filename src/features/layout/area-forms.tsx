import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Rect } from '../../domain/layout/types';
import { Button } from '../../ui/button';
import { NumberField, SelectField, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';

export function RectFields({ rect, onChange }: { rect: Rect; onChange(patch: Partial<Rect>): void }) {
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
      <div className="row2">
        <SelectField<Aisle['kind']> label="Aisle" value={aisle.kind}
          options={[{ value: 'cold', label: 'Cold' }, { value: 'hot', label: 'Hot' }]} onChange={(kind) => set({ kind })} />
        <NumberField label="Width mm" value={aisle.widthMm} min={100} onChange={(widthMm) => set({ widthMm })} />
      </div>
      <p className="muted">Drag sideways on the canvas to reorder. Spans the rack area depth.</p>
      <div className="row2">
        <Button onClick={() => editor.addTray(aisle.id)}>+ Tray above</Button>
        <Button variant="danger" onClick={() => { editor.removeElement('aisles', aisle.id); onRemoved(); }}>Remove aisle</Button>
      </div>
    </div>
  );
}

export function TrayForm({ tray, layout, editor, onRemoved }: { tray: CableTray; layout: DcLayout; editor: LayoutEditor; onRemoved(): void }) {
  const set = (patch: Partial<CableTray>) => editor.updateElement<CableTray>('trays', tray.id, patch);
  return (
    <div className="card">
      <div className="row2">
        <SelectField<CableTray['kind']> label="Tray" value={tray.kind}
          options={[{ value: 'data', label: 'Data' }, { value: 'power', label: 'Power' }]} onChange={(kind) => set({ kind })} />
        <NumberField label="Width mm" value={tray.widthMm} min={50} onChange={(widthMm) => set({ widthMm })} />
      </div>
      <SelectField label="Above aisle" value={tray.aisleId}
        options={layout.aisles.map((a, i) => ({ value: a.id, label: `${a.kind} aisle ${i + 1} (${a.id})` }))}
        onChange={(aisleId) => set({ aisleId })} />
      <Button variant="danger" onClick={() => { editor.removeElement('trays', tray.id); onRemoved(); }}>Remove tray</Button>
    </div>
  );
}

const facilityKinds: { value: FacilityKind; label: string }[] = [
  { value: 'pdu', label: 'PDU / power' }, { value: 'cooling', label: 'Cooling (CRAH/CDU)' }, { value: 'other', label: 'Other' },
];

export function FacilityForm({ facility: f, editor, onRemoved }: { facility: Facility; editor: LayoutEditor; onRemoved(): void }) {
  const set = (patch: Partial<Facility>) => editor.updateElement<Facility>('facilities', f.id, patch);
  return (
    <div className="card">
      <div className="row2">
        <TextField label="Name" value={f.name} onChange={(name) => set({ name })} />
        <SelectField<FacilityKind> label="Kind" value={f.kind} options={facilityKinds} onChange={(kind) => set({ kind })} />
      </div>
      <RectFields rect={f} onChange={set} />
      <NumberField label="Capacity kW" value={f.capacityKw ?? 0} min={0} onChange={(capacityKw) => set({ capacityKw: capacityKw || undefined })} />
      <Button variant="danger" onClick={() => { editor.removeElement('facilities', f.id); onRemoved(); }}>Remove facility</Button>
    </div>
  );
}
