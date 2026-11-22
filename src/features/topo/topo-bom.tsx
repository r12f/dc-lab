import { useMemo } from 'react';
import type { Library } from '../../domain/library/library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { VirtualTopo } from '../../domain/topo/virtual';
import { estimateTopoBom, opticChoices, poolKey, topoBomColumns, type PoolEstimate, type TopoBomSettings } from '../../domain/topo/bom';
import { traitsOf } from '../../domain/device/categories';
import { lineTotalW } from '../../domain/bom/types';
import { formatPower } from '../../domain/units';
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
 * Pane under the virtual topology: what building it takes. Each group's device type and each pool's optic are
 * picked here (saved with the topology, not in its YAML); the BOM merges them by item type.
 */
export function TopoBomPane({ lib, topo, settings, onChange, filename, height }: Props) {
  const defs = useAppStore((s) => s.project.propertyDefs);
  const bom = useMemo(() => estimateTopoBom(lib, topo, settings), [lib, topo, settings]);
  const columns = useMemo(() => topoBomColumns(defs), [defs]);
  // Device types a group can be: every device but fillers and room-level equipment, by category.
  const deviceTypes = useMemo(() => {
    const byCat = new Map<string, DeviceDefinition[]>();
    for (const d of lib.devices.items()) {
      const t = traitsOf(d.category);
      if (t.filler || t.facility) continue;
      byCat.set(t.label, [...(byCat.get(t.label) ?? []), d]);
    }
    return [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [lib]);
  const set = (patch: Partial<TopoBomSettings>) => onChange({ ...settings, ...patch });
  const devices = topo.groups.reduce((n, g) => n + g.count, 0);
  const optics = bom.lines.filter((l) => l.kind === 'optic').reduce((n, l) => n + l.qty, 0);
  const power = bom.lines.reduce((w, l) => w + lineTotalW(l), 0);
  const upperBound = bom.groups.some((g) => g.pools.some((p) => p.ports && !p.exact));

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
                  <th>Group</th><th>Role</th><th className="num">Devices</th><th>Device type</th><th>Pool</th>
                  <th className="num">Ports / device</th><th className="num">Cages / device</th><th>Optic per cage</th><th className="num">Optics</th>
                </tr>
              </thead>
              <tbody>
                {bom.groups.map(({ group: g, deviceId, pools }) => {
                  const choices = opticChoices(lib, deviceId);
                  const rows = pools.length ? pools : [undefined];
                  return rows.map((p, i) => (
                    <tr key={`${g.name}\u0000${p?.pool ?? ''}`}>
                      {i === 0 && (
                        <>
                          <td rowSpan={rows.length}>{g.name}</td>
                          <td rowSpan={rows.length}>{g.role}</td>
                          <td rowSpan={rows.length} className="num">{fmt(g.count)}</td>
                          <td rowSpan={rows.length}>
                            <select aria-label={`Device type of ${g.name}`} value={deviceId ?? ''}
                              onChange={(e) => set({ devices: withKey(settings.devices, g.name, e.target.value || undefined) })}>
                              <option value="">— not set —</option>
                              {deviceTypes.map(([cat, ds]) => (
                                <optgroup key={cat} label={cat}>{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
                              ))}
                            </select>
                          </td>
                        </>
                      )}
                      {p ? (
                        <>
                          <td>{p.pool}</td>
                          <td className="num">{bound(p, p.ports)}</td>
                          <td className="num">{bound(p, p.cages)}</td>
                          <td>
                            <select aria-label={`Optic of ${g.name} ${p.pool}`} value={p.opticId ?? ''}
                              onChange={(e) => set({ optics: withKey(settings.optics, poolKey(g.name, p.pool), e.target.value || undefined) })}>
                              <option value="">None</option>
                              {/* A picked optic that no longer fits the device type stays listed, so the pick shows. */}
                              {[...choices, ...(p.opticId && !choices.some((o) => o.id === p.opticId) ? [lib.optics.get(p.opticId)!] : [])]
                                .map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </td>
                          <td className="num">{p.opticId ? bound(p, p.optics) : ''}</td>
                        </>
                      ) : <td colSpan={5} className="muted">no port pools</td>}
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
            itemsOf={(id) => lib.variants.of(id)} onPick={(key, itemId) => set({ items: withKey(settings.items, key, itemId) })} />
          <p className="muted">Cables, fiber housings, racks and power distribution depend on the DC layout and are not estimated.</p>
        </Section>
      </div>
    </section>
  );
}
