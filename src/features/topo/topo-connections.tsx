import { useMemo, useState } from 'react';
import type { Library } from '../../domain/library/library';
import { GENERIC_SUFFIX } from '../../domain/items/types';
import { variantLabel } from '../../domain/items/variants';
import { cableBomToCsv, type CableBomRow } from '../../domain/topo/bom';
import { connectionsToCsv, filterConnections, type PortConnection } from '../../domain/topo/connections';
import type { VLink } from '../../domain/topo/virtual';
import { formatGbps, formatPower } from '../../domain/units';
import { downloadText } from '../../io/download';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';

export const CONNECTIONS_PAGE_SIZE = 200;

const fmt = (n: number) => n.toLocaleString('en-US');

function endpointSummary(lib: Library, group: string, deviceType: string | undefined, pool: string): string {
  const dev = deviceType ? (lib.devices.get(deviceType)?.name ?? `${deviceType} (unknown)`) : 'no device_type';
  return `${group} · ${dev} · ${pool}`;
}

/** Filter end-to-end port connections by any connection field or resolved per-link Cable PN. */
export function filterConnectionsWithPn(
  rows: readonly PortConnection[],
  query: string,
  cablePnByLink: ReadonlyMap<number, string>,
): PortConnection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  const matched = new Set(filterConnections(rows, query).map((r) => r.index));
  return rows.filter((r) => matched.has(r.index) || (cablePnByLink.get(r.linkIndex) ?? '').toLowerCase().includes(needle));
}

export interface TopoConnectionsProps {
  lib: Library;
  links?: readonly VLink[];
  cableBom: readonly CableBomRow[];
  connections: readonly PortConnection[];
  filename: string;
  onPick(pickKey: string, itemId: string | undefined): void;
  /** Optional controlled/initial filter query (primarily for deterministic tests). */
  initialQuery?: string;
  /** Optional 0-based initial page index (primarily for deterministic tests). */
  initialPage?: number;
}

export function TopoConnectionsSection({
  lib,
  links,
  cableBom,
  connections,
  filename,
  onPick,
  initialQuery = '',
  initialPage = 0,
}: TopoConnectionsProps) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);

  const cablePnByLink = useMemo(
    () => new Map(cableBom.map((row, idx) => [links?.[idx]?.index ?? idx, row.vendorModel])),
    [cableBom, links],
  );

  const filtered = useMemo(
    () => filterConnectionsWithPn(connections, query, cablePnByLink),
    [connections, query, cablePnByLink],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / CONNECTIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * CONNECTIONS_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + CONNECTIONS_PAGE_SIZE);

  const opticLabel = (id?: string) => (id ? (lib.optics.get(id)?.name ?? `${id} (unknown)`) : 'not set');
  const cableLabel = (id?: string) => (id ? (lib.cableMedia.get(id)?.name ?? `${id} (unknown)`) : 'not set');

  const showingLabel = filtered.length
    ? `Showing ${fmt(start + 1)}–${fmt(start + pageRows.length)} of ${fmt(filtered.length)}`
    : 'Showing 0 of 0';

  return (
    <>
      <Section title="Connection summary (Cable BOM)">
        <div className="table-scroll">
          <table className="table topo-bom-hw topo-cable-bom">
            <thead>
              <tr>
                <th>Link</th>
                <th>From</th>
                <th>From Mode</th>
                <th>From Optic</th>
                <th>To</th>
                <th>To Mode</th>
                <th>To Optic</th>
                <th className="num">Links</th>
                <th>Cable</th>
                <th>Vendor / Model (PN)</th>
                <th className="num">Qty</th>
                <th className="num">Power/pcs</th>
                <th className="num">Total W</th>
              </tr>
            </thead>
            <tbody>
              {cableBom.length > 0 ? cableBom.map((r, idx) => (
                <tr key={`${idx}\u0000${r.link}`} title={r.derivation || undefined}>
                  <td>{r.link}</td>
                  <td>{endpointSummary(lib, r.fromGroup, r.fromDeviceType, r.fromPool)}</td>
                  <td>{r.fromMode}</td>
                  <td className={r.fromOpticId ? undefined : 'muted'}>{opticLabel(r.fromOpticId)}</td>
                  <td>{endpointSummary(lib, r.toGroup, r.toDeviceType, r.toPool)}</td>
                  <td>{r.toMode}</td>
                  <td className={r.toOpticId ? undefined : 'muted'}>{opticLabel(r.toOpticId)}</td>
                  <td className="num">{r.links !== undefined ? fmt(r.links) : ''}</td>
                  <td className={r.cableId ? undefined : 'muted'}>{cableLabel(r.cableId)}</td>
                  <td>
                    {r.pickKey ? (
                      <select
                        className="bom-pick"
                        aria-label={`Cable PN for ${r.link}`}
                        title="Item (vendor / PN) bought for this cable"
                        value={r.itemId ?? ''}
                        onChange={(e) => onPick(r.pickKey!, e.target.value.endsWith(GENERIC_SUFFIX) ? undefined : e.target.value)}
                      >
                        {lib.variants.of(r.pickKey).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.id.endsWith(GENERIC_SUFFIX) ? 'Generic' : variantLabel(x) || x.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted">{r.vendorModel}</span>
                    )}
                  </td>
                  <td className="num">
                    {r.cableId ? (
                      <div className="topo-cable-qty">
                        <span>{fmt(r.qty)}</span>
                        {r.derivation && <small>{r.derivation}</small>}
                      </div>
                    ) : ''}
                  </td>
                  <td className="num">{r.unitW ? formatPower(r.unitW) : ''}</td>
                  <td className="num">{r.totalW ? formatPower(r.totalW) : ''}</td>
                </tr>
              )) : (
                <tr><td colSpan={13} className="muted">No links defined.</td></tr>
              )}
            </tbody>
          </table>
          <Button onClick={() => downloadText(`${filename}-cable-bom.csv`, cableBomToCsv(lib, cableBom), 'text/csv')}>
            Export Cable BOM CSV
          </Button>
        </div>
      </Section>

      <Section title="End-to-end port connections">
        <div className="topo-conn-bar">
          <input
            aria-label="Filter port connections"
            placeholder="Filter by device, port, link, optic, cable…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          <div className="topo-conn-page">
            <Button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Prev</Button>
            <span>{showingLabel}</span>
            <Button disabled={start + CONNECTIONS_PAGE_SIZE >= filtered.length} onClick={() => setPage(safePage + 1)}>Next</Button>
          </div>
          <Button onClick={() => downloadText(`${filename}-connections.csv`, connectionsToCsv(filtered), 'text/csv')}>
            Export Connections CSV
          </Button>
        </div>
        <div className="table-scroll">
          <table className="table topo-conn-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>From Device</th>
                <th>From Role</th>
                <th>From Pool Port</th>
                <th>From Device Port</th>
                <th>From Mode</th>
                <th>From Optic</th>
                <th>To Device</th>
                <th>To Role</th>
                <th>To Pool Port</th>
                <th>To Device Port</th>
                <th>To Mode</th>
                <th>To Optic</th>
                <th className="num">Speed</th>
                <th>Cable</th>
                <th>Cable PN</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? pageRows.map((r) => {
                const pn = cablePnByLink.get(r.linkIndex) ?? '';
                return (
                  <tr key={r.index}>
                    <td>{r.linkName}</td>
                    <td>{r.fromDeviceId}</td>
                    <td>{r.fromRole}</td>
                    <td>{r.fromPoolPort}</td>
                    <td className={r.fromDevicePort ? undefined : 'muted'}>{r.fromDevicePort}</td>
                    <td>{r.fromMode}</td>
                    <td className={r.fromOpticName ? undefined : 'muted'}>{r.fromOpticName}</td>
                    <td>{r.toDeviceId}</td>
                    <td>{r.toRole}</td>
                    <td>{r.toPoolPort}</td>
                    <td className={r.toDevicePort ? undefined : 'muted'}>{r.toDevicePort}</td>
                    <td>{r.toMode}</td>
                    <td className={r.toOpticName ? undefined : 'muted'}>{r.toOpticName}</td>
                    <td className="num">{r.speedGbps !== undefined ? formatGbps(r.speedGbps) : ''}</td>
                    <td className={r.cableName ? undefined : 'muted'}>{r.cableName}</td>
                    <td className={pn ? undefined : 'muted'}>{pn}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={16} className="muted">No matching port connections.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
