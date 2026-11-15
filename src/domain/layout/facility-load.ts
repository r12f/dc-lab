import type { Library } from '../library/library';
import { computeRackMetrics, type RackMetrics } from '../design/metrics';
import type { DcLayout, Facility } from './types';
import type { DesignLookup } from './tiles';
import { assignmentRole } from './infra';

/**
 * Facility loads, computed from the racks — never typed in:
 * - a row's power demand = max power of its racks except power racks (they pass power on to the IT racks);
 * - a PDU facility feeds the rows it lists; a row fed by n PDUs takes 1/n of its demand from each;
 * - a hot aisle's heat = demand of the rows exhausting into it (rear side) minus the capacity of the in-row
 *   chillers in those rows (chillers draw power, counted in their row's demand);
 * - a cooling facility serves the hot aisles it lists; an aisle served by n units puts 1/n of its heat on each.
 */
export interface FacilityLoads {
  rowDemandKw: Map<string, number>;
  /** Hot aisle id -> heat load after chillers (kW). */
  aisleHeatKw: Map<string, number>;
  /** Hot aisle id -> chiller capacity taking heat out of it (kW). */
  aisleChillerKw: Map<string, number>;
  /** Facility id -> load (kW) and per-row / per-aisle share. */
  facility: Map<string, { loadKw: number; capacityKw?: number; shares: { id: string; kw: number }[] }>;
  warnings: string[];
}

/** Max power of a facility (kW): its own setting, else its device item's supply capacity. */
export function facilityCapacityKw(lib: Library, f: Facility): number | undefined {
  if (f.capacityKw !== undefined) return f.capacityKw;
  const d = f.deviceId ? lib.devices.get(f.deviceId) : undefined;
  if (!d) return undefined;
  const kw = (d.power.capacityW ?? 0) / 1000 || (d.cooling?.capacityKw ?? 0);
  return kw || undefined;
}

/** Hot aisle a row exhausts into: the band on its rear side, if it is a hot aisle. */
export function rowHotAisle(l: DcLayout, rowId: string): string | undefined {
  const row = l.rows.find((r) => r.id === rowId);
  const i = l.sequence.indexOf(rowId);
  if (!row || i < 0) return undefined;
  // Front faces east -> rear (exhaust) is west = previous band in the west-to-east sequence.
  const id = l.sequence[row.frontFacing === 'east' ? i - 1 : i + 1];
  return l.aisles.find((a) => a.id === id && a.kind === 'hot' && !a.cross)?.id;
}

export function computeFacilityLoads(lib: Library, designs: DesignLookup, l: DcLayout): FacilityLoads {
  const cache = new Map<string, RackMetrics | undefined>();
  const metrics = (designId: string) => {
    if (!cache.has(designId)) { const d = designs(designId); cache.set(designId, d && computeRackMetrics(lib, d)); }
    return cache.get(designId);
  };
  const rowDemandKw = new Map<string, number>();
  const rowChillerKw = new Map<string, number>();
  for (const r of l.rows) { rowDemandKw.set(r.id, 0); rowChillerKw.set(r.id, 0); }
  for (const a of l.assignments) {
    const role = assignmentRole(lib, designs, a);
    const m = metrics(a.designId);
    if (!m || role === 'power' || !rowDemandKw.has(a.rowId)) continue;
    rowDemandKw.set(a.rowId, rowDemandKw.get(a.rowId)! + m.maxW / 1000);
    if (role === 'chiller') rowChillerKw.set(a.rowId, rowChillerKw.get(a.rowId)! + m.coolingCapacityKw);
  }
  const aisleHeatKw = new Map<string, number>();
  const aisleChillerKw = new Map<string, number>();
  for (const a of l.aisles.filter((x) => x.kind === 'hot')) { aisleHeatKw.set(a.id, 0); aisleChillerKw.set(a.id, 0); }
  for (const r of l.rows) {
    const hot = rowHotAisle(l, r.id);
    if (!hot) continue;
    aisleHeatKw.set(hot, aisleHeatKw.get(hot)! + rowDemandKw.get(r.id)!);
    aisleChillerKw.set(hot, aisleChillerKw.get(hot)! + rowChillerKw.get(r.id)!);
  }
  for (const [id, heat] of aisleHeatKw) aisleHeatKw.set(id, Math.max(0, heat - aisleChillerKw.get(id)!));

  const warnings: string[] = [];
  const facility: FacilityLoads['facility'] = new Map();
  const share = (kind: 'pdu' | 'cooling', targets: Map<string, number>, linksOf: (f: Facility) => string[] | undefined) => {
    const fs = l.facilities.filter((f) => f.kind === kind);
    const fanIn = new Map<string, number>();
    for (const f of fs) for (const id of linksOf(f) ?? []) if (targets.has(id)) fanIn.set(id, (fanIn.get(id) ?? 0) + 1);
    for (const f of fs) {
      const shares = (linksOf(f) ?? []).filter((id) => targets.has(id)).map((id) => ({ id, kw: targets.get(id)! / fanIn.get(id)! }));
      const loadKw = shares.reduce((n, s) => n + s.kw, 0);
      const capacityKw = facilityCapacityKw(lib, f);
      facility.set(f.id, { loadKw, capacityKw, shares });
      const what = kind === 'pdu' ? 'feeds' : 'cools';
      if (capacityKw !== undefined && loadKw > capacityKw + 1e-9) warnings.push(`${f.name}: ${what} ${loadKw.toFixed(1)} kW but max is ${capacityKw} kW`);
    }
  };
  share('pdu', rowDemandKw, (f) => f.rowIds);
  share('cooling', aisleHeatKw, (f) => f.aisleIds);
  return { rowDemandKw, aisleHeatKw, aisleChillerKw, facility, warnings };
}

/** Removes links to rows / aisles that no longer exist. */
export function pruneFacilityLinks(l: DcLayout): DcLayout {
  const rows = new Set(l.rows.map((r) => r.id));
  const aisles = new Set(l.aisles.map((a) => a.id));
  let changed = false;
  const facilities = l.facilities.map((f) => {
    const rowIds = f.rowIds?.filter((id) => rows.has(id));
    const aisleIds = f.aisleIds?.filter((id) => aisles.has(id));
    if (rowIds?.length === f.rowIds?.length && aisleIds?.length === f.aisleIds?.length) return f;
    changed = true;
    return { ...f, rowIds, aisleIds };
  });
  return changed ? { ...l, facilities } : l;
}

/** PDUs feeding a row / cooling units serving an aisle. */
export const pdusOfRow = (l: DcLayout, rowId: string) => l.facilities.filter((f) => f.kind === 'pdu' && f.rowIds?.includes(rowId));
export const coolersOfAisle = (l: DcLayout, aisleId: string) => l.facilities.filter((f) => f.kind === 'cooling' && f.aisleIds?.includes(aisleId));
