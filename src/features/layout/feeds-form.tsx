import type { DcLayout, Facility, Row } from '../../domain/layout/types';
import { facilityAllocatedKw, feedsToRow, rowSupplyKw } from '../../domain/layout/power-feeds';
import { NumberField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';

/** Per-row kW this PDU feeds (0 = not connected), with the PDU's allocation vs capacity. */
export function PduFeedsForm({ layout, pdu, editor }: { layout: DcLayout; pdu: Facility; editor: LayoutEditor }) {
  const alloc = facilityAllocatedKw(layout, pdu.id);
  const over = pdu.capacityKw !== undefined && alloc > pdu.capacityKw;
  const rows = layout.sequence.map((id) => layout.rows.find((r) => r.id === id)).filter((r): r is Row => !!r);
  return (
    <div className="subcard">
      <strong>Feeds to rows</strong>
      <p className={over ? 'error' : 'muted'}>{`Allocated ${alloc} kW${pdu.capacityKw !== undefined ? ` of ${pdu.capacityKw} kW` : ''}`}</p>
      {rows.length === 0 && <p className="muted">Add rows first.</p>}
      <div className="row3">
        {rows.map((r) => (
          <NumberField key={r.id} label={`${r.name} kW`} min={0}
            value={layout.feeds.find((f) => f.facilityId === pdu.id && f.rowId === r.id)?.kw ?? 0}
            onChange={(kw) => editor.setPowerFeed(pdu.id, r.id, Math.max(0, kw))} />
        ))}
      </div>
    </div>
  );
}

/** Which PDUs feed this row and how much, against the row's draw. */
export function RowFeedsSummary({ layout, row, drawW }: { layout: DcLayout; row: Row; drawW: number }) {
  const feeds = feedsToRow(layout, row.id);
  const supply = rowSupplyKw(layout, row.id);
  if (!feeds.length) return <p className="muted">Not fed by any PDU yet — select a PDU to connect it.</p>;
  const short = drawW / 1000 > supply;
  return (
    <div className="subcard">
      <strong>Power feeds</strong>
      {feeds.map((f) => <div key={f.id} className="muted">{`${layout.facilities.find((x) => x.id === f.facilityId)?.name ?? '?'} → ${f.kw} kW`}</div>)}
      <p className={short ? 'error' : 'muted'}>{`Fed ${supply} kW · draws ${(drawW / 1000).toFixed(1)} kW`}</p>
    </div>
  );
}
