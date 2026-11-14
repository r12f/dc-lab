import type { Library } from '../../domain/library/library';
import type { DcLayout, Facility, Row } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { computeFacilityLoads, pdusOfRow } from '../../domain/layout/facility-load';
import type { LayoutEditor } from './use-layout-editor';

const toggle = (xs: string[] | undefined, id: string) => (xs?.includes(id) ? xs.filter((x) => x !== id) : [...(xs ?? []), id]);

/** PDU: which rows it feeds; cooling: which hot aisles it serves. The kW per link is computed, not entered. */
export function FacilityLinksForm({ lib, designs, layout, facility: f, editor }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; facility: Facility; editor: LayoutEditor;
}) {
  const load = computeFacilityLoads(lib, designs, layout).facility.get(f.id);
  const kw = (id: string) => load?.shares.find((s) => s.id === id)?.kw;
  const over = load?.capacityKw !== undefined && load.loadKw > load.capacityKw;
  const summary = load && `${f.kind === 'pdu' ? 'Feeds' : 'Cools'} ${load.loadKw.toFixed(1)} kW${load.capacityKw !== undefined ? ` of ${load.capacityKw} kW max` : ' (no max power set)'}`;
  const isPdu = f.kind === 'pdu';
  const targets = isPdu
    ? layout.sequence.map((id) => layout.rows.find((r) => r.id === id)).filter((r): r is Row => !!r).map((r) => ({ id: r.id, name: r.name }))
    : layout.sequence.map((id) => layout.aisles.find((a) => a.id === id && a.kind === 'hot')).filter((a) => !!a).map((a, i) => ({ id: a!.id, name: `Hot aisle ${i + 1}` }));
  const links = isPdu ? f.rowIds : f.aisleIds;
  return (
    <div className="subcard">
      <strong>{isPdu ? 'Feeds rows' : 'Serves hot aisles'}</strong>
      <p className="muted">{isPdu
        ? "Each row's load (max power of its racks, power racks excluded) is split evenly over the PDUs feeding it."
        : "Each hot aisle's heat (rows exhausting into it, minus their in-row chillers) is split evenly over the units serving it."}</p>
      {targets.length === 0 && <p className="muted">{isPdu ? 'Add rows first.' : 'No hot aisles yet.'}</p>}
      {targets.map((t) => (
        <label key={t.id} className="checkbox" style={{ display: 'block' }}>
          <input type="checkbox" checked={!!links?.includes(t.id)}
            onChange={() => editor.setFacilityLinks(f.id, isPdu ? { rowIds: toggle(f.rowIds, t.id) } : { aisleIds: toggle(f.aisleIds, t.id) })} />
          {` ${t.name}${kw(t.id) !== undefined ? ` — ${kw(t.id)!.toFixed(1)} kW` : ''}`}
        </label>
      ))}
      {summary && <p className={over ? 'error' : 'muted'}>{summary}</p>}
    </div>
  );
}

/** Which PDUs feed this row and its computed demand. */
export function RowFeedsSummary({ lib, designs, layout, row }: { lib: Library; designs: DesignLookup; layout: DcLayout; row: Row }) {
  const pdus = pdusOfRow(layout, row.id);
  const demand = computeFacilityLoads(lib, designs, layout).rowDemandKw.get(row.id) ?? 0;
  if (!pdus.length) return <p className="muted">{`Draws ${demand.toFixed(1)} kW max; not fed by any PDU yet — select a PDU to connect it.`}</p>;
  return (
    <div className="subcard">
      <strong>Power feeds</strong>
      <p className="muted">{`Draws ${demand.toFixed(1)} kW max: ${(demand / pdus.length).toFixed(1)} kW from each of ${pdus.map((p) => p.name).join(', ')}`}</p>
    </div>
  );
}

/** Heat of a hot aisle after chillers, and the units cooling it. */
export function AisleHeatSummary({ lib, designs, layout, aisleId }: { lib: Library; designs: DesignLookup; layout: DcLayout; aisleId: string }) {
  const loads = computeFacilityLoads(lib, designs, layout);
  const heat = loads.aisleHeatKw.get(aisleId);
  if (heat === undefined) return null;
  const chill = loads.aisleChillerKw.get(aisleId) ?? 0;
  const units = layout.facilities.filter((f) => f.kind === 'cooling' && f.aisleIds?.includes(aisleId));
  return (
    <div className="subcard">
      <strong>Heat load</strong>
      <p className="muted">{`${heat.toFixed(1)} kW${chill ? ` after ${chill.toFixed(1)} kW of in-row chillers` : ''}${units.length ? ` · cooled by ${units.map((u) => u.name).join(', ')}` : ' · no cooling unit serves it'}`}</p>
    </div>
  );
}
