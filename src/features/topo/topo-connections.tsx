import type { Library } from '../../domain/library/library';
import { GENERIC_SUFFIX } from '../../domain/items/types';
import { variantLabel } from '../../domain/items/variants';
import { cableBomToCsv, type CableBomRow } from '../../domain/topo/bom';
import { connectionsToCsv, expandTopoConnections } from '../../domain/topo/connections';
import { topoDeviceIdMap } from '../../domain/topo/devices';
import { topoHardware, type GroupHardware } from '../../domain/topo/hardware';
import type { VirtualTopo } from '../../domain/topo/virtual';
import { formatPower } from '../../domain/units';
import { downloadText } from '../../io/download';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';

const fmt = (n: number) => n.toLocaleString('en-US');

function endpointSummary(lib: Library, group: string, deviceType: string | undefined, pool: string): string {
  const dev = deviceType ? (lib.devices.get(deviceType)?.name ?? `${deviceType} (unknown)`) : 'no device_type';
  return `${group} · ${dev} · ${pool}`;
}

export interface TopoConnectionsProps {
  lib: Library;
  topo: VirtualTopo;
  hardware?: ReadonlyMap<string, GroupHardware>;
  totalLinks?: number;
  cableBom: readonly CableBomRow[];
  filename: string;
  onPick(pickKey: string, itemId: string | undefined): void;
  /** Optional download handler (defaults to browser `downloadText`). */
  download?(filename: string, text: string, mime?: string): void;
}

export function TopoConnectionsSection({
  lib,
  topo,
  hardware,
  totalLinks,
  cableBom,
  filename,
  onPick,
  download = downloadText,
}: TopoConnectionsProps) {
  const linkCount = totalLinks ?? topo.links.reduce((n, l) => n + (l.links ?? 0), 0);
  const opticLabel = (id?: string) => (id ? (lib.optics.get(id)?.name ?? `${id} (unknown)`) : 'not set');
  const cableLabel = (id?: string) => (id ? (lib.cableMedia.get(id)?.name ?? `${id} (unknown)`) : 'not set');

  const handleExportCableBom = () => {
    download(`${filename}-cable-bom.csv`, cableBomToCsv(lib, cableBom), 'text/csv');
  };

  const handleExportConnections = () => {
    if (linkCount === 0) return;
    const resolvedHw = hardware ?? topoHardware(lib, topo);
    const rows = expandTopoConnections(lib, topo, resolvedHw, topoDeviceIdMap(topo));
    const cablePnByLink = new Map(cableBom.map((row, idx) => [topo.links[idx]?.index ?? idx, row.vendorModel]));
    download(`${filename}-connections.csv`, connectionsToCsv(rows, cablePnByLink), 'text/csv');
  };

  return (
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
        <div className="topo-conn-actions">
          <Button onClick={handleExportCableBom}>
            Export Cable BOM CSV
          </Button>
          <Button disabled={linkCount === 0} onClick={handleExportConnections}>
            Export Connections CSV
          </Button>
        </div>
      </div>
    </Section>
  );
}
