import { useState, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, RackDesign } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { endpointKey, placementConnectors, planAssignments, splitSelection, usedConnectors } from '../../domain/design/cable-assign';
import { endpointLabel } from '../../domain/design/connectors';
import { unitsIn } from '../../domain/units';
import { paint } from '../../theme/paint';
import { Button } from '../../ui/button';
import { SelectField } from '../../ui/fields';
import type { DesignEditor } from './use-design-editor';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  face: PortFace;
  onSelectCable(id: string | undefined): void;
}

const BOX = { w: 30, h: 20, gap: 3 };
const PER_LINE = 32;
const LABEL_W = 150;
const ROW_PAD = 8;

/** Top-to-bottom order: rack devices by top unit (highest first), then side-mounted devices. */
function rowOrder(lib: Library, design: RackDesign) {
  const rack = lib.racks.get(design.templateId);
  const top = (p: RackDesign['placements'][number]) => {
    if (p.mount.kind !== 'rack') return -Infinity;
    const d = lib.devices.get(p.deviceId);
    return p.mount.position + (d && rack ? Math.max(1, unitsIn(d.height, rack.unitSystem)) : 1) - 1;
  };
  return [...design.placements].sort((a, b) => top(b) - top(a));
}

/**
 * Cabling view: every device's connector map for one rack face. Click connectors to select (shift = range
 * on the same device); the selection is split into A (first device) and B (other devices) ends, and the chosen
 * cable is repeated over them in faceplate order (A1..A10 ↔ B1..B10 = 10 runs).
 */
export function CablingView({ ref, lib, design, editor, face, onSelectCable }: Props) {
  const [selection, setSelection] = useState<CableEndpoint[]>([]);
  const [anchor, setAnchor] = useState<string>();
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const [mediaId, setMediaId] = useState(media[0]?.id ?? '');
  const [route, setRoute] = useState<CableRoute | 'auto'>('auto');
  const [message, setMessage] = useState<string>();

  const used = usedConnectors(design);
  const runColor = new Map(design.cables.map((c) => [c.id, lib.cableMedia.get(c.mediaId)?.color ?? paint.inkMuted]));
  const rows = rowOrder(lib, design).map((p) => ({ p, conns: placementConnectors(lib, design, p, face) }));
  const order = new Map(rows.flatMap((r) => r.conns.map((e, i) => [endpointKey(e), i] as const)));
  const selected = new Set(selection.map(endpointKey));

  // A/B split by device, each side in faceplate order so repeats pair 1↔1, 2↔2…
  const byFaceplate = (eps: CableEndpoint[]) => [...eps].sort((x, y) =>
    x.placementId === y.placementId ? (order.get(endpointKey(x)) ?? 0) - (order.get(endpointKey(y)) ?? 0) : 0);
  const split = splitSelection(selection);
  const a = byFaceplate(split.a);
  const b = byFaceplate(split.b);
  const plan = selection.length ? planAssignments(lib, design, a, b, mediaId, route) : undefined;

  const click = (row: CableEndpoint[], ep: CableEndpoint, range: boolean) => {
    const key = endpointKey(ep);
    setMessage(undefined);
    const runId = used.get(key);
    if (runId && !range) { onSelectCable(runId); return; }
    if (range && anchor) {
      const i = row.findIndex((e) => endpointKey(e) === anchor);
      const j = row.findIndex((e) => endpointKey(e) === key);
      if (i >= 0 && j >= 0) {
        const span = row.slice(Math.min(i, j), Math.max(i, j) + 1).filter((e) => !used.has(endpointKey(e)) && !selected.has(endpointKey(e)));
        setSelection([...selection, ...span]);
        setAnchor(key);
        return;
      }
    }
    setSelection(selected.has(key) ? selection.filter((e) => endpointKey(e) !== key) : [...selection, ep]);
    setAnchor(key);
  };

  const assign = () => {
    if (!plan || plan.error) return;
    const last = editor.addCables(plan.runs).at(-1);
    setMessage(`${plan.runs.length} cable${plan.runs.length > 1 ? 's' : ''} assigned`);
    setSelection([]);
    setAnchor(undefined);
    onSelectCable(last);
  };

  // Geometry: one row per device, connectors wrapped PER_LINE per line.
  let y = 0;
  const laid = rows.map(({ p, conns }) => {
    const lines = Math.max(1, Math.ceil(conns.length / PER_LINE));
    const h = ROW_PAD * 2 + 12 + lines * (BOX.h + BOX.gap);
    const r = { p, conns, y, h };
    y += h + 4;
    return r;
  });
  const width = LABEL_W + PER_LINE * (BOX.w + BOX.gap) + 10;
  const height = Math.max(y, 40);

  return (
    <div className="cabling-view">
      <div className="cabling-bar">
        <SelectField label="Cable" value={mediaId} options={media.map((m) => ({ value: m.id, label: m.name }))} onChange={setMediaId} />
        <SelectField<CableRoute | 'auto'> label="Route" value={route}
          options={[{ value: 'auto', label: 'auto (shorter)' }, { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' }]}
          onChange={setRoute} />
        <span className="muted">{`A ${a.length} · B ${b.length}`}</span>
        <Button variant="primary" disabled={!plan || !!plan.error} onClick={assign}>
          {plan && !plan.error ? `Assign ${plan.runs.length} cable${plan.runs.length > 1 ? 's' : ''}` : 'Assign'}
        </Button>
        <Button disabled={!selection.length} onClick={() => { setSelection([]); setAnchor(undefined); }}>Clear</Button>
        {plan?.error && <span className="warn">{plan.error}</span>}
        {message && !plan && <span className="muted">{message}</span>}
      </div>
      <p className="muted">Click connectors to select, shift-click for a range. A = first device selected, B = the others; the cable repeats in port order. Click a cabled connector to open its run.</p>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing">
        <rect width={width} height={height} fill={paint.paper} />
        {laid.length === 0 && <text x={10} y={24} fontSize={12} fill={paint.inkMuted}>No devices placed.</text>}
        {laid.map(({ p, conns, y: ry, h }) => {
          const device = lib.devices.get(p.deviceId);
          const side = a.some((e) => e.placementId === p.id) ? 'A' : b.some((e) => e.placementId === p.id) ? 'B' : undefined;
          return (
            <g key={p.id} transform={`translate(0 ${ry})`}>
              <rect x={2} y={0} width={width - 4} height={h} rx={4} fill="#1e293b" stroke={side ? paint.selection : '#475569'} strokeWidth={side ? 2 : 1} />
              <text x={10} y={ROW_PAD + 12} fontSize={12} fontWeight={700} fill="#f8fafc">{`${side ? `[${side}] ` : ''}${p.label}`}</text>
              <text x={10} y={ROW_PAD + 26} fontSize={10} fill="#cbd5e1">{device?.name ?? p.deviceId}</text>
              {conns.length === 0 && <text x={LABEL_W} y={ROW_PAD + 26} fontSize={10} fill="#94a3b8">{`no ${face}-side ports`}</text>}
              {conns.map((ep, i) => {
                const key = endpointKey(ep);
                const runId = used.get(key);
                const sel = selected.has(key);
                const x = LABEL_W + (i % PER_LINE) * (BOX.w + BOX.gap);
                const by = ROW_PAD + 12 + Math.floor(i / PER_LINE) * (BOX.h + BOX.gap);
                const fill = runId ? runColor.get(runId) : sel ? paint.selection : '#334155';
                const multiLeg = conns.filter((c) => c.portRef === ep.portRef).length > 1;
                const text = `${ep.portRef.split('/')[1] ?? ep.portRef}${multiLeg ? `.${ep.connector}` : ''}`;
                return (
                  <g key={key} style={{ cursor: 'pointer' }} onClick={(e) => click(conns, ep, e.shiftKey)}>
                    <title>{`${endpointLabel(design, ep)}${runId ? ' · cabled (click to open run)' : ''}`}</title>
                    <rect x={x} y={by} width={BOX.w} height={BOX.h} rx={2} fill={fill}
                      stroke={sel ? '#fff' : '#0f172a'} strokeWidth={sel ? 2 : 1} />
                    <text x={x + BOX.w / 2} y={by + 13} fontSize={8} textAnchor="middle" fontWeight={600}
                      fill={runId || sel ? '#0f172a' : '#e2e8f0'} pointerEvents="none">{text}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
