import { useMemo, useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { VirtualTopo } from '../../domain/topo/virtual';
import { estimateTopoBom, topoBomColumns, type PoolEstimate, type TopoBomSettings } from '../../domain/topo/bom';
import { expandTopoConnections } from '../../domain/topo/connections';
import { topoDeviceIdMap } from '../../domain/topo/devices';
import { topoHardware, type GroupHardware } from '../../domain/topo/hardware';
import { lineTotalW } from '../../domain/bom/types';
import { formatGbps, formatPower } from '../../domain/units';
import { useAppStore } from '../../state/store';
import { BomTable } from '../../ui/bom-table';
import { StatGrid } from '../../ui/stat-grid';
import { Section } from '../../ui/fields';
import { Tabs } from '../../ui/tabs';
import { TopoConnectionsSection } from './topo-connections';

export type TopoBottomTab = 'bom' | 'connections';

interface Props {
  lib: Library;
  topo: VirtualTopo;
  hardware?: ReadonlyMap<string, GroupHardware>;
  settings: TopoBomSettings;
  onChange(settings: TopoBomSettings): void;
  /** File name stem of the CSV export. */
  filename: string;
  /** Pane height (px). */
  height: number;
  /** Optional controlled/initial sub-tab (`'bom'` | `'connections'`). */
  initialTab?: TopoBottomTab;
  initialFilter?: string;
  initialPage?: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');
/** A per-device figure, `≤ n` when devices of the group use fewer (uneven sets, filtered ends). */
const bound = (p: PoolEstimate, n: number) => `${p.exact ? '' : '≤ '}${fmt(n)}`;

/** One key of a settings map set (or dropped when undefined); an empty map becomes undefined. */
function withKey(m: Record<string, string> | undefined, key: string, value: string | undefined): Record<string, string> | undefined {
  const next = { ...m };
  if (value) next[key] = value;
  else delete next[key];
  return Object.keys(next).length ? next : undefined;
}

/**
 * Bottom pane under the virtual topology diagram with 2 sub-tabs:
 * 1. `Estimated BOM`: device/link/optic/cable stats, hardware per group, and full procurement BOM table.
 * 2. `Port Connections (<total>)`: per-link Cable BOM summary and end-to-end point-to-point port connections.
 */
export function TopoBomPane({
  lib,
  topo,
  hardware,
  settings,
  onChange,
  filename,
  height,
  initialTab = 'bom',
  initialFilter,
  initialPage,
}: Props) {
  const [tab, setTab] = useState<TopoBottomTab>(initialTab);
  const defs = useAppStore((s) => s.project.propertyDefs);
  const resolvedHw = useMemo(() => hardware ?? topoHardware(lib, topo), [hardware, lib, topo]);
  const bom = useMemo(() => estimateTopoBom(lib, topo, settings), [lib, topo, settings]);
  const connections = useMemo(
    () => expandTopoConnections(lib, topo, resolvedHw, topoDeviceIdMap(topo)),
    [lib, topo, resolvedHw],
  );
  const columns = useMemo(() => topoBomColumns(defs), [defs]);
  const devices = topo.groups.reduce((n, g) => n + g.count, 0);
  const optics = bom.lines.filter((l) => l.kind === 'optic').reduce((n, l) => n + l.qty, 0);
  const cables = bom.lines.filter((l) => l.kind === 'cable').reduce((n, l) => n + l.qty, 0);
  const power = bom.lines.reduce((w, l) => w + lineTotalW(l), 0);
  const upperBound = bom.groups.some((g) => g.pools.some((p) => p.ports && !p.exact));
  const opticName = (id: string) => lib.optics.get(id)?.name ?? `${id} (unknown)`;
  const onPick = (key: string, itemId: string | undefined) => onChange({ ...settings, items: withKey(settings.items, key, itemId) });

  return (
    <section className="topo-bom" style={{ height }} aria-label="Topology BOM and Port Connections">
      <div className="topo-bom-head">
        <Tabs<TopoBottomTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'bom', label: 'Estimated BOM' },
            { id: 'connections', label: `Port Connections (${fmt(connections.length)})` },
          ]}
        />
      </div>
      <div className="topo-bom-body">
        {tab === 'bom' ? (
          <>
            <StatGrid stats={[
              { label: 'Devices', value: fmt(devices) },
              { label: 'Links', value: fmt(bom.links) },
              { label: 'Optics', value: fmt(optics) },
              { label: 'Cables', value: fmt(cables) },
              { label: 'Typical power', value: formatPower(power) },
            ]} />
            <Section title="Hardware per group">
              <div className="table-scroll">
                <table className="table topo-bom-hw">
                  <thead>
                    <tr>
                      <th>Group</th><th>Role</th><th className="num">Devices</th><th>Device type</th><th>Breakout profile</th><th>Pool</th><th className="num">Speed</th>
                      <th className="num">Ports / device</th><th className="num">Cages / device</th><th>Optic per cage</th><th className="num">Optics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bom.groups.map(({ group: g, deviceId, profileName, pools }) => {
                      const rows = pools.length ? pools : [undefined];
                      const device = lib.devices.get(deviceId);
                      return rows.map((p, i) => (
                        <tr key={`${g.name}\u0000${p?.pool ?? ''}`}>
                          {i === 0 && (
                            <>
                              <td rowSpan={rows.length}>{g.name}</td>
                              <td rowSpan={rows.length}>{g.role}</td>
                              <td rowSpan={rows.length} className="num">{fmt(g.count)}</td>
                              <td rowSpan={rows.length} className={device ? undefined : 'muted'} title={device?.id}>
                                {device ? device.name : g.deviceType ? `${g.deviceType} (unknown)` : 'no device_type'}
                              </td>
                              <td rowSpan={rows.length} className={profileName ? undefined : 'muted'}>{profileName ?? (device && Object.keys(g.poolNames).length ? 'none fits' : '')}</td>
                            </>
                          )}
                          {p ? (
                            <>
                              <td>{p.pool}</td>
                              <td className="num">{p.speedGbps ? formatGbps(p.speedGbps) : ''}</td>
                              <td className="num">{bound(p, p.ports)}</td>
                              <td className="num">{bound(p, p.cages)}</td>
                              <td className={g.poolOptics[p.pool] ? undefined : 'muted'}>{g.poolOptics[p.pool] ? opticName(g.poolOptics[p.pool]) : 'not set'}</td>
                              <td className="num">{p.optics.length ? p.optics.map((o) => `${p.exact ? '' : '≤ '}${fmt(o.total)}`).join(', ') : ''}</td>
                            </>
                          ) : <td colSpan={6} className="muted">no port pools</td>}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
              {upperBound && (
                <p className="muted">≤: devices of uneven sets or filtered link ends use fewer ports; counted at the largest set's need (the port grid's fill).</p>
              )}
            </Section>
            <Section title="BOM">
              <BomTable lines={bom.lines} filename={`${filename}-estimated`} columns={columns}
                itemsOf={(id) => lib.variants.of(id)} onPick={onPick} />
              <p className="muted">
                Cables: per link spec, the cable the link sets — over the links one cable carries. Cable lengths, fiber
                housings, trunks, racks and power distribution depend on the DC layout and are not estimated.
              </p>
            </Section>
          </>
        ) : (
          <TopoConnectionsSection
            lib={lib}
            links={topo.links}
            cableBom={bom.cableBom}
            connections={connections}
            filename={filename}
            onPick={onPick}
            initialQuery={initialFilter}
            initialPage={initialPage}
          />
        )}
      </div>
    </section>
  );
}
