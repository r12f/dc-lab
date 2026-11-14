import { uniqueId } from '../ids';
import type { DcLayout, Facility, PowerFeed, Row } from './types';

/** Feeds into a row / out of a facility. */
export const feedsToRow = (l: DcLayout, rowId: string) => l.feeds.filter((f) => f.rowId === rowId);
export const feedsFromFacility = (l: DcLayout, facilityId: string) => l.feeds.filter((f) => f.facilityId === facilityId);

/** kW a row receives from all its feeds. */
export function rowSupplyKw(l: DcLayout, rowId: string): number {
  return feedsToRow(l, rowId).reduce((n, f) => n + f.kw, 0);
}

/** kW a facility has allocated to rows. */
export function facilityAllocatedKw(l: DcLayout, facilityId: string): number {
  return feedsFromFacility(l, facilityId).reduce((n, f) => n + f.kw, 0);
}

/**
 * Sets the feed from `facilityId` to `rowId` to `kw`; kw <= 0 removes it. One feed per PDU-row pair.
 */
export function setFeed(l: DcLayout, facilityId: string, rowId: string, kw: number): DcLayout {
  const existing = l.feeds.find((f) => f.facilityId === facilityId && f.rowId === rowId);
  if (kw <= 0) return existing ? { ...l, feeds: l.feeds.filter((f) => f !== existing) } : l;
  if (existing) return { ...l, feeds: l.feeds.map((f) => (f === existing ? { ...f, kw } : f)) };
  const feed: PowerFeed = { id: uniqueId('feed', l.feeds.map((f) => f.id)), facilityId, rowId, kw };
  return { ...l, feeds: [...l.feeds, feed] };
}

/** Drops feeds whose PDU or row no longer exists. */
export function pruneFeeds(l: DcLayout): DcLayout {
  const rows = new Set(l.rows.map((r) => r.id));
  const fac = new Set(l.facilities.map((f) => f.id));
  const feeds = l.feeds.filter((f) => rows.has(f.rowId) && fac.has(f.facilityId));
  return feeds.length === l.feeds.length ? l : { ...l, feeds };
}

/** Feed problems: PDU over-allocated, row drawing more than it is fed. Rows without feeds are not checked. */
export function feedWarnings(l: DcLayout, rowDemandW: Map<string, number>): string[] {
  const out: string[] = [];
  for (const f of l.facilities) {
    const alloc = facilityAllocatedKw(l, f.id);
    if (f.capacityKw !== undefined && alloc > f.capacityKw) out.push(`${f.name}: feeds ${alloc} kW but capacity is ${f.capacityKw} kW`);
  }
  for (const r of l.rows) {
    const supply = rowSupplyKw(l, r.id);
    const demandKw = (rowDemandW.get(r.id) ?? 0) / 1000;
    if (feedsToRow(l, r.id).length && demandKw > supply) out.push(`${r.name}: draws ${demandKw.toFixed(1)} kW but is fed ${supply} kW`);
  }
  return out;
}

export type { Facility, Row };
