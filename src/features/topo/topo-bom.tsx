import { useMemo } from 'react';
import type { Library } from '../../domain/library/library';
import type { VirtualTopo } from '../../domain/topo/virtual';
import { estimateTopoBom, topoBomColumns, type PoolEstimate, type TopoBomSettings } from '../../domain/topo/bom';
import { lineTotalW } from '../../domain/bom/types';
import { formatGbps, formatPower } from '../../domain/units';
import { useAppStore } from '../../state/store';
import { BomTable } from '../../ui/bom-table';
import { StatGrid } from '../../ui/stat-grid';
import { Section } from '../../ui/fields';

interface Props {
  lib: Library;
  topo: VirtualTopo;
  settings: TopoBomSettings;
  onChange(settings: TopoBomSettings): void;
  /** File name stem of the CSV export. */
  filename: string;
  /** Pane height (px). */
  height: number;
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
 * Pane under the virtual topology: what building it takes. Hardware: each group's `device_type` and `port_map`, run
 * at the device type's breakout profile matched to the group's ports (modes and optics, Devices module); the item
 * bought for each line is picked here (saved with the topology).
 */
export function TopoBomPane({ lib, topo, settings, onChange, filename, height }: Props) {
  const defs = useAppStore((s) => s.project.propertyDefs);
  const bom = useMemo(() => estimateTopoBom(lib, topo, settings), [lib, topo, settings]);
  const columns = useMemo(() => topoBomColumns(defs), [defs]);
  const devices = topo.groups.reduce((n, g) => n + g.count, 0);
  const optics = bom.lines.filter((l) => l.kind === 'optic').reduce((n, l) => n + l.qty, 0);
  const power = bom.lines.reduce((w, l) => w + lineTotalW(l), 0);
  const upperBound = bom.groups.some((g) => g.pools.some((p) => p.ports && !p.exact));
  const opticName = (id: string) => lib.optics.get(id)?.name ?? id;

  return (
    <section className="topo-bom" style={{ height }} aria-label="Estimated BOM From Virtual Topo">
      <div className="topo-bom-head"><h2>Estimated BOM From Virtual Topo</h2></div>
      <div className="topo-bom-body">
        <StatGrid stats={[
          { label: 'Devices', value: fmt(devices) },
          { label: 'Links', value: fmt(bom.links) },
          { label: 'Optics', value: fmt(optics) },
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
                          <td rowSpan={rows.length} className={profileName ? undefined : 'muted'}>{profileName ?? (device && g.portMap.length ? 'none fits' : '')}</td>
                        </>
                      )}
                      {p ? (
                        <>
                          <td>{p.pool}</td>
                          <td className="num">{p.speedGbps ? formatGbps(p.speedGbps) : ''}</td>
                          <td className="num">{bound(p, p.ports)}</td>
                          <td className="num">{p.cages === undefined ? '' : bound(p, p.cages)}</td>
                          <td className={p.optics.length ? undefined : 'muted'}>
                            {p.optics.length ? p.optics.map((o) => opticName(o.opticId)).join(', ') : p.cages === undefined ? 'no port_map' : 'none'}
                          </td>
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
            itemsOf={(id) => lib.variants.of(id)} onPick={(key, itemId) => onChange({ ...settings, items: withKey(settings.items, key, itemId) })} />
          <p className="muted">Cables, fiber housings, racks and power distribution depend on the DC layout and are not estimated.</p>
        </Section>
      </div>
    </section>
  );
}
