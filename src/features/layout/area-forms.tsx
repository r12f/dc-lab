import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Rect } from '../../domain/layout/types';
import { NumberField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import { BatchNumber, BatchSelect, BatchText, common } from './batch-fields';

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

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

export function AisleForm({ aisles, editor }: { aisles: Aisle[]; editor: LayoutEditor }) {
  const set = (patch: Partial<Aisle>) => editor.updateElements<Aisle>('aisles', ids(aisles), patch);
  return (
    <div className="row2">
      <BatchSelect<Aisle['kind']> label="Aisle" value={common(aisles, 'kind')}
        options={[{ value: 'cold', label: 'Cold' }, { value: 'hot', label: 'Hot' }]} onChange={(kind) => set({ kind })} />
      <BatchNumber label="Width mm" value={common(aisles, 'widthMm')} min={100} onChange={(widthMm) => set({ widthMm })} />
    </div>
  );
}

export function TrayForm({ trays, layout, editor }: { trays: CableTray[]; layout: DcLayout; editor: LayoutEditor }) {
  const set = (patch: Partial<CableTray>) => editor.updateElements<CableTray>('trays', ids(trays), patch);
  const aisleOrder = layout.sequence.filter((id) => layout.aisles.some((a) => a.id === id));
  return (
    <>
      <div className="row2">
        <BatchSelect<CableTray['kind']> label="Tray" value={common(trays, 'kind')}
          options={[{ value: 'data', label: 'Data' }, { value: 'power', label: 'Power' }]} onChange={(kind) => set({ kind })} />
        <BatchNumber label="Width mm" value={common(trays, 'widthMm')} min={50} onChange={(widthMm) => set({ widthMm })} />
      </div>
      {trays.length === 1 && (
        <BatchSelect label="Above aisle" value={trays[0].aisleId}
          options={aisleOrder.map((id, i) => ({ value: id, label: `${layout.aisles.find((a) => a.id === id)?.kind} aisle ${i + 1}` }))}
          onChange={(aisleId) => set({ aisleId })} />
      )}
    </>
  );
}

const facilityKinds: { value: FacilityKind; label: string }[] = [
  { value: 'pdu', label: 'PDU / power' }, { value: 'cooling', label: 'Cooling (CRAH/CDU)' }, { value: 'other', label: 'Other' },
];

export function FacilityForm({ facilities, editor }: { facilities: Facility[]; editor: LayoutEditor }) {
  const set = (patch: Partial<Facility>) => editor.updateElements<Facility>('facilities', ids(facilities), patch);
  const one = facilities.length === 1 ? facilities[0] : undefined;
  return (
    <>
      <div className="row2">
        {one && <BatchText label="Name" value={one.name} onChange={(name) => set({ name })} />}
        <BatchSelect<FacilityKind> label="Kind" value={common(facilities, 'kind')} options={facilityKinds} onChange={(kind) => set({ kind })} />
      </div>
      {one && (
        <div className="row2">
          <NumberField label="X mm" value={one.x} onChange={(x) => set({ x })} />
          <NumberField label="Y mm" value={one.y} onChange={(y) => set({ y })} />
        </div>
      )}
      <div className="row3">
        <BatchNumber label="Width mm" value={common(facilities, 'widthMm')} onChange={(widthMm) => set({ widthMm })} />
        <BatchNumber label="Depth mm" value={common(facilities, 'depthMm')} onChange={(depthMm) => set({ depthMm })} />
        <BatchNumber label="Capacity kW" value={common(facilities, 'capacityKw')} min={0} onChange={(capacityKw) => set({ capacityKw: capacityKw || undefined })} />
      </div>
    </>
  );
}
