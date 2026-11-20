import { useEffect, useMemo, useRef, useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { faceRows, formatPortRef, groupCols, portCell, portName } from '../../domain/device/ports';
import { rackPortLayout, sidePorts, traceTopology, type TraceSide } from '../../domain/layout/topo-trace';
import { uniqueId } from '../../domain/ids';
import { useTraces } from '../../state/traces';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';

export interface TraceSides { a?: TraceSide; b?: TraceSide }

type PortPick = { placementId: string; portRef: string };
const pickKey = (p: PortPick) => `${p.placementId}#${p.portRef}`;

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  /** Rack selected on the plan (one), offered as A / B side. */
  selectedRackId?: string;
  sides: TraceSides;
  onSides(s: TraceSides): void;
}

/**
 * Topo tracing side bar, shaped like the cross-rack cabling one: A and B columns, each listing EVERY port of its
 * rack laid out like the cabling view. Pick ports (press and sweep), or click a device name for all its ports; none
 * picked = the whole rack. Trace puts the result in the Traces pane.
 */
export function TracePanel({ lib, designs, layout, selectedRackId, sides, onSides }: Props) {
  const add = useTraces((s) => s.add);
  const traces = useTraces((s) => s.traces);
  const [msg, setMsg] = useState<string>();
  const selected = layout.assignments.find((a) => a.id === selectedRackId);
  const set = (k: 'a' | 'b', v: TraceSide | undefined) => { onSides({ ...sides, [k]: v }); setMsg(undefined); };
  const label = (s: TraceSide) => {
    const a = layout.assignments.find((x) => x.id === s.assignmentId);
    const d = a && designs(a.designId);
    const devs = [...new Set((s.ports ?? []).map((x) => x.placementId))].map((id) => d?.placements.find((p) => p.id === id)?.label ?? id);
    const n = s.ports?.length ?? 0;
    return [a?.label ?? '?', devs.length ? `${devs.slice(0, 2).join(', ')}${devs.length > 2 ? '…' : ''}` : '', n ? `${n}p` : ''].filter(Boolean).join(' · ');
  };
  const run = () => {
    if (!sides.a) return;
    const r = traceTopology(lib, designs, layout, sides.a, sides.b);
    if (!r.links.length) { setMsg(sides.b ? 'No path from A to B.' : 'Nothing is connected to A.'); return; }
    const id = uniqueId('trace', traces.map((t) => t.id));
    add({ id, name: `${label(sides.a)} → ${sides.b ? label(sides.b) : 'all'}`, layoutId: layout.id, a: sides.a, b: sides.b, ...r });
    setMsg(`${r.links.length} links traced.`);
  };
  return (
    <div className="inspector-inner">
      <Section title="Topo tracing">
        <p className="muted">Select a rack on the plan and set it as A or B side. Pick ports below (press and sweep, or click a device name for all its ports); nothing picked = the whole rack. Without B, everything connected to A is traced.</p>
        <div className="row3 cross-set">
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as A side` : 'Select a rack on the plan'}
            onClick={() => selected && set('a', { assignmentId: selected.id })}>{`Set A${selected ? ` = ${selected.label}` : ''}`}</Button>
          <Button disabled={!sides.a && !sides.b} title="Swap A and B sides (picked ports swap with them)" onClick={() => onSides({ a: sides.b, b: sides.a })}>⇄</Button>
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as B side` : 'Select a rack on the plan'}
            onClick={() => selected && set('b', { assignmentId: selected.id })}>{`Set B${selected ? ` = ${selected.label}` : ''}`}</Button>
        </div>
        <div className="row2">
          <Button variant="primary" disabled={!sides.a} onClick={run}>Trace</Button>
          <span className="muted">{msg ?? ''}</span>
        </div>
      </Section>
      <div className="cross-sides">
        {(['a', 'b'] as const).map((k) => (
          <SideColumn key={k} lib={lib} designs={designs} layout={layout} name={k.toUpperCase()} side={sides[k]}
            onChange={(v) => set(k, v)} />
        ))}
      </div>
    </div>
  );
}

function SideColumn({ lib, designs, layout, name, side, onChange }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; name: string; side?: TraceSide; onChange(s: TraceSide | undefined): void;
}) {
  // Press on a port and sweep over others: they all take the pressed port's new state (pick / unpick).
  const sweep = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const up = () => { sweep.current = undefined; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);
  const rack = side && layout.assignments.find((a) => a.id === side.assignmentId);
  const design = rack && designs(rack.designId);
  const devices = useMemo(() => (design ? rackPortLayout(lib, design) : []), [lib, design]);
  const picked = side?.ports ?? [];
  const sel = new Set(picked.map(pickKey));
  const total = side ? sidePorts(lib, designs, layout, side).length : 0;
  // Functional update via the latest side: sweeping fires many marks before a re-render.
  const latest = useRef(side);
  latest.current = side;
  const mark = (ps: PortPick[], on: boolean) => {
    const s = latest.current;
    if (!s) return;
    const cur = s.ports ?? [];
    const have = new Set(cur.map(pickKey));
    const next = on ? [...cur, ...ps.filter((x) => !have.has(pickKey(x)))] : cur.filter((x) => !ps.some((y) => pickKey(y) === pickKey(x)));
    const ns = { ...s, ports: next.length ? next : undefined };
    latest.current = ns;
    onChange(ns);
  };
  return (
    <div className="cross-side">
      <div className="cross-side-head">
        <div className="cross-side-title">
          <strong>{`${name} side`}</strong>
          <button type="button" className="link" style={{ visibility: picked.length ? 'visible' : 'hidden' }}
            disabled={!picked.length} onClick={() => side && onChange({ assignmentId: side.assignmentId })}>{`clear ${picked.length}`}</button>
        </div>
        <span className="muted">{rack ? `${rack.label} · ${design?.name ?? '?'} · ${picked.length ? `${total} picked` : `whole rack (${total})`}` : 'not set'}</span>
      </div>
      {rack && devices.map((d) => {
        const all = d.faces.flatMap((f) => f.groups.flatMap((g) => Array.from({ length: g.count }, (_, i) => ({ placementId: d.placement.id, portRef: formatPortRef({ groupId: g.id, index: i + 1 }) }))));
        const allOn = all.length > 0 && all.every((x) => sel.has(pickKey(x)));
        return (
          <div key={d.placement.id} className="cross-device">
            <button type="button" className={`link cross-device-name${allOn ? ' selected' : ''}`}
              title={allOn ? 'Unpick every port of this device' : 'Pick every port of this device'}
              onClick={() => mark(all, !allOn)}>{`${allOn ? '☑' : '☐'} ${d.placement.label}`}</button>
            {d.faces.map(({ face, groups }) => (
              <div key={face} className="cross-face">
                {d.faces.length > 1 && <div className="muted cross-face-name">{face}</div>}
                {faceRows(groups).map((line) => (
                  <div key={line[0].id} className="cross-face-groups">
                    {line.map((group) => {
                      const rows = Math.max(1, group.rows);
                      const cols = groupCols(group, rows);
                      return (
                        <div key={group.id} className="cross-group">
                          <div className="muted">{group.label}</div>
                          <div className="cross-grid" style={{ gridTemplateColumns: `repeat(${cols}, auto)`, gridTemplateRows: `repeat(${rows}, auto)` }}>
                            {Array.from({ length: group.count }, (_, i) => {
                              const { col, row } = portCell(group, i, rows);
                              const pk = { placementId: d.placement.id, portRef: formatPortRef({ groupId: group.id, index: i + 1 }) };
                              const k = pickKey(pk);
                              const label = portName(group, i + 1);
                              return (
                                <div key={k} className="cross-cell" style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                                  <button type="button" title={`${d.placement.label} ${group.label} ${label}`}
                                    className={`cross-port${sel.has(k) ? ' selected' : ''}`}
                                    onPointerDown={(ev) => {
                                      if (ev.button !== 0) return;
                                      ev.preventDefault();
                                      (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
                                      sweep.current = !sel.has(k);
                                      mark([pk], sweep.current);
                                    }}
                                    onPointerEnter={() => { if (sweep.current !== undefined) mark([pk], sweep.current); }}>{label}</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Traces pane (left sidebar in tracing mode): the session's traces of this layout; click one to view it. */
export function TraceList({ layoutId }: { layoutId: string }) {
  const traces = useTraces((s) => s.traces).filter((t) => t.layoutId === layoutId);
  const openId = useTraces((s) => s.openId);
  const open = useTraces((s) => s.open);
  const remove = useTraces((s) => s.remove);
  return (
    <div className="palette">
      <div className="sidebar-group-title">Traces</div>
      <div className="palette-list">
        {!traces.length && <p className="muted pad">No traces yet: set A (and B) in the right panel and press Trace. Traces are kept for this session only.</p>}
        {traces.map((t) => (
          <div key={t.id} className={`palette-item${t.id === openId ? ' active' : ''}`} style={{ cursor: 'pointer' }}
            title="Show this trace (click again for the plan)" onClick={() => open(t.id === openId ? undefined : t.id)}>
            <span className="sidebar-item-name">{t.name}</span>
            <span className="badge">{`${t.links.length}`}</span>
            <Button className="btn-icon" variant="danger" aria-label="Delete trace" title="Delete trace"
              onClick={(e) => { e.stopPropagation(); remove(t.id); }}>✕</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
