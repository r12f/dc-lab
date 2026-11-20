import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { cableGroupsOnFace, formatPortRef, portName } from '../../domain/device/ports';
import { sidePorts, traceTopology, type TraceSide } from '../../domain/layout/topo-trace';
import { uniqueId } from '../../domain/ids';
import { useTraces } from '../../state/traces';
import { Button } from '../../ui/button';
import { Section, SelectField } from '../../ui/fields';

export interface TraceSides { a?: TraceSide; b?: TraceSide }

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  /** Rack selected on the plan (one), offered as A / B side. */
  selectedRackId?: string;
  sides: TraceSides;
  onSides(s: TraceSides): void;
}

/** Topo tracing side bar: A side and B side (rack, device or port), then Trace — the result goes to the Traces pane. */
export function TracePanel({ lib, designs, layout, selectedRackId, sides, onSides }: Props) {
  const add = useTraces((s) => s.add);
  const traces = useTraces((s) => s.traces);
  const [msg, setMsg] = useState<string>();
  const selected = layout.assignments.find((a) => a.id === selectedRackId);
  const set = (k: 'a' | 'b', v: TraceSide | undefined) => { onSides({ ...sides, [k]: v }); setMsg(undefined); };
  const label = (s: TraceSide) => {
    const a = layout.assignments.find((x) => x.id === s.assignmentId);
    const p = a && designs(a.designId)?.placements.find((x) => x.id === s.placementId);
    const d = p && lib.devices.get(p.deviceId);
    const g = d && s.portRef ? cableGroupsOnFace(d, 'front').concat(cableGroupsOnFace(d, 'rear')).find((x) => s.portRef!.startsWith(`${x.id}/`)) : undefined;
    const port = g && s.portRef ? `${g.label} ${portName(g, Number(s.portRef.split('/').pop()))}` : '';
    return [a?.label ?? '?', p?.label, port].filter(Boolean).join(' · ');
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
        <p className="muted">Select a rack on the plan and set it as A or B side, then narrow it to a device or a port. Without B, everything connected to A is traced.</p>
        <div className="row3 cross-set">
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as A side` : 'Select a rack on the plan'}
            onClick={() => selected && set('a', { assignmentId: selected.id })}>{`Set A${selected ? ` = ${selected.label}` : ''}`}</Button>
          <Button disabled={!sides.a && !sides.b} title="Swap A and B sides" onClick={() => onSides({ a: sides.b, b: sides.a })}>⇄</Button>
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as B side` : 'Select a rack on the plan'}
            onClick={() => selected && set('b', { assignmentId: selected.id })}>{`Set B${selected ? ` = ${selected.label}` : ''}`}</Button>
        </div>
        {(['a', 'b'] as const).map((k) => (
          <SideFields key={k} lib={lib} designs={designs} layout={layout} name={k.toUpperCase()} side={sides[k]}
            ports={sides[k] ? sidePorts(lib, designs, layout, sides[k]!).length : 0}
            onChange={(v) => set(k, v)} />
        ))}
        <Button variant="primary" disabled={!sides.a} onClick={run}>Trace</Button>
        {msg && <p className="muted">{msg}</p>}
      </Section>
    </div>
  );
}

function SideFields({ lib, designs, layout, name, side, ports, onChange }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; name: string; side?: TraceSide; ports: number; onChange(s: TraceSide | undefined): void;
}) {
  const rack = side && layout.assignments.find((a) => a.id === side.assignmentId);
  const design = rack && designs(rack.designId);
  const placement = side?.placementId ? design?.placements.find((p) => p.id === side.placementId) : undefined;
  const device = placement && lib.devices.get(placement.deviceId);
  const portOptions = device
    ? (['front', 'rear'] as const).flatMap((f) => cableGroupsOnFace(device, f)).flatMap((g) =>
      Array.from({ length: g.count }, (_, i) => ({ value: formatPortRef({ groupId: g.id, index: i + 1 }), label: `${g.label} ${portName(g, i + 1)}` })))
    : [];
  return (
    <div className="card">
      <div className="cross-side-title">
        <strong>{`${name} side${rack ? ` · ${rack.label}` : ''}`}</strong>
        <button type="button" className="link" style={{ visibility: side ? 'visible' : 'hidden' }} onClick={() => onChange(undefined)}>clear</button>
      </div>
      {!rack ? <span className="muted">not set</span> : (
        <>
          <SelectField<string> label="Device" value={side?.placementId ?? ''}
            options={[{ value: '', label: 'Whole rack' }, ...(design?.placements ?? []).map((p) => ({ value: p.id, label: p.label }))]}
            onChange={(v) => onChange({ assignmentId: rack.id, placementId: v || undefined })} />
          {device && (
            <SelectField<string> label="Port" value={side?.portRef ?? ''}
              options={[{ value: '', label: 'All ports' }, ...portOptions]}
              onChange={(v) => onChange({ assignmentId: rack.id, placementId: placement!.id, portRef: v || undefined })} />
          )}
          <span className="muted">{`${ports} port${ports === 1 ? '' : 's'}`}</span>
        </>
      )}
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
