import type { Aisle, CableTray, DcLayout, Facility, FacilityKind, Rect } from '../../domain/layout/types';
import { NumberField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import type { Library } from '../../domain/library/library';
import { facilityCapacityKw } from '../../domain/layout/facility-load';
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
  const cross = aisles.every((a) => a.cross);
  return (
    <>
      <div className="row2">
        <BatchSelect<Aisle['kind']> label={cross ? 'Cross aisle' : 'Aisle'} value={common(aisles, 'kind')}
          options={[{ value: 'cold', label: 'Cold' }, { value: 'hot', label: 'Hot' }]} onChange={(kind) => set({ kind })} />
        <BatchNumber label={cross ? 'Width (north–south) mm' : 'Width mm'} value={common(aisles, 'widthMm')} min={100} onChange={(widthMm) => set({ widthMm })} />
      </div>
      {cross && <p className="muted">Runs east–west across the rack area between two row blocks.</p>}
    </>
  );
}

/** Name of a band: "Row 3", "cold aisle 2", "cross aisle 1". */
export function bandName(layout: DcLayout, id: string): string {
  const row = layout.rows.find((r) => r.id === id);
  if (row) return row.name;
  const a = layout.aisles.find((x) => x.id === id);
  if (!a) return id;
  const same = layout.sequence.filter((x) => layout.aisles.some((y) => y.id === x && !!y.cross === !!a.cross));
  return `${a.cross ? 'cross' : a.kind} aisle ${same.indexOf(id) + 1}`;
}

export function TrayForm({ trays, layout, editor }: { trays: CableTray[]; layout: DcLayout; editor: LayoutEditor }) {
  const set = (patch: Partial<CableTray>) => editor.updateElements<CableTray>('trays', ids(trays), patch);
  const floating = trays.every((t) => t.floating);
  if (floating) {
    const one = trays.length === 1 ? trays[0] : undefined;
    // Bands of the sequence, cross aisles left out (a floating tray spans rows / aisles of row blocks).
    const bands = layout.sequence.filter((id) => !layout.aisles.find((a) => a.id === id)?.cross)
      .map((id) => ({ value: id, label: bandName(layout, id) }));
    return (
      <>
        <div className="row3">
          <BatchSelect<CableTray['kind']> label="Floating tray" value={common(trays, 'kind')}
            options={[{ value: 'data', label: 'Data' }, { value: 'power', label: 'Power' }]} onChange={(kind) => set({ kind })} />
          <BatchNumber label="Width mm" value={common(trays, 'widthMm')} min={50} onChange={(widthMm) => set({ widthMm })} />
          {one && <BatchNumber label="Y mm (north edge)" value={one.y} onChange={(y) => editor.moveFloatingTray(one.id, y)} />}
        </div>
        {one && (
          <div className="row2">
            <BatchSelect label="From (west)" value={one.fromId} options={bands} onChange={(fromId) => set({ fromId })} />
            <BatchSelect label="To (east)" value={one.toId} options={bands} onChange={(toId) => set({ toId })} />
          </div>
        )}
        <p className="muted">Runs across the rows over the rack tops, from one row / aisle to another. Drag it north–south.</p>
      </>
    );
  }
  return (
    <>
      <div className="row3">
        <BatchSelect<CableTray['kind']> label="Tray" value={common(trays, 'kind')}
          options={[{ value: 'data', label: 'Data' }, { value: 'power', label: 'Power' }]} onChange={(kind) => set({ kind })} />
        <BatchNumber label="Width mm" value={common(trays, 'widthMm')} min={50} onChange={(widthMm) => set({ widthMm })} />
        <BatchNumber label="Offset mm (+ east/south)" value={common(trays, 'offsetMm') ?? (trays.every((t) => !t.offsetMm) ? 0 : undefined)}
          onChange={(offsetMm) => set({ offsetMm: offsetMm || undefined })} />
      </div>
      {trays.length === 1 && (
        <BatchSelect label="Runs along" value={trays[0].overId}
          options={layout.sequence.filter((id) => layout.aisles.some((a) => a.id === id)).map((id) => ({ value: id, label: bandName(layout, id) }))}
          onChange={(overId) => editor.moveTray(trays[0].id, overId)} />
      )}
      <p className="muted">Runs along an aisle or cross aisle. Drag it onto another one.</p>
    </>
  );
}

const facilityKinds: { value: FacilityKind; label: string }[] = [
  { value: 'pdu', label: 'PDU / power' }, { value: 'cooling', label: 'Cooling (CRAH/CDU)' }, { value: 'other', label: 'Other' },
];

/** Device categories a facility kind can pick its item from. */
const ITEM_CATEGORIES: Partial<Record<FacilityKind, string[]>> = { pdu: ['dc-pdu'], cooling: ['chiller', 'cdu'] };

export function FacilityForm({ lib, facilities, editor }: { lib: Library; facilities: Facility[]; editor: LayoutEditor }) {
  const set = (patch: Partial<Facility>) => editor.updateElements<Facility>('facilities', ids(facilities), patch);
  const one = facilities.length === 1 ? facilities[0] : undefined;
  const kind = common(facilities, 'kind');
  const cats = kind ? ITEM_CATEGORIES[kind] : undefined;
  const items = cats ? lib.devices.items().filter((d) => cats.includes(d.category)) : [];
  const itemMax = one ? facilityCapacityKw(lib, { ...one, capacityKw: undefined }) : undefined;
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
        <BatchNumber label={`Max power kW${itemMax !== undefined && one?.capacityKw === undefined ? ` (item: ${itemMax})` : ''}`} value={common(facilities, 'capacityKw')} min={0}
          onChange={(capacityKw) => set({ capacityKw: capacityKw || undefined })} />
      </div>
      {cats && (
        <BatchSelect label={kind === 'pdu' ? 'DC PDU item' : 'Cooling item'} value={common(facilities, 'deviceId') ?? ''}
          options={[{ value: '', label: '(none)' }, ...items.map((d) => ({ value: d.id, label: d.name }))]}
          onChange={(deviceId) => set({ deviceId: deviceId || undefined })} />
      )}
      {cats && <p className="muted">Max power empty = the item's capacity. Loads are computed from the linked rows / hot aisles.</p>}
    </>
  );
}
