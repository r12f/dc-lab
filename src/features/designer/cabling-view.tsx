import { useEffect, useRef, useState, type PointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, Placement, RackDesign } from '../../domain/design/types';
import type { DeviceDefinition, PortFace, PortGroup } from '../../domain/device/types';
import { applicableCables, deviceFaceSeenFrom, endpointKey, planCable, splitSelection, usedConnectors } from '../../domain/design/cable-assign';
import { endpointLabel } from '../../domain/design/connectors';
import { resolvePlacedPort } from '../../domain/design/optics';
import { formatPortRef, groupsOnFace } from '../../domain/device/ports';
import { portLegs, type PortLeg } from '../../domain/ports/legs';
import { groupTitle } from '../devices/drawing/group-title';
import { unitsIn } from '../../domain/units';
import { placedDevice } from '../../domain/design/sizing';
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

/**
 * Port block: the port number on top, its connector legs side by side below, each a three-line cable block
 * (lanes / reach / connector, e.g. "4x200G", "DR4", "MPO-8"). Sized to stay compact so a 64-port face fits.
 */
const PORT_HEAD = 11;
const LEG_W = 36;
const LEG_H = 32;
const LEG_GAP = 2;
const PORT_PAD = 2;

const GAP = 3;
const GROUP_GAP = 14;
const PAD = 6;
const LABEL_W = 120;
const TITLE_H = 13;

interface LegBox { ep: CableEndpoint; leg: PortLeg; x: number; y: number; w: number; h: number }
interface PortBox { group: PortGroup; index: number; mode: string; x: number; y: number; w: number; h: number }
interface DeviceLayout {
  p: Placement; device: DeviceDefinition; y: number; h: number; w: number;
  ports: PortBox[]; legs: LegBox[]; titles: { text: string; x: number; y: number }[];
}

/** Top-to-bottom order: rack devices by top unit (highest first), then side-mounted devices. */
function rowOrder(lib: Library, design: RackDesign) {
  const rack = lib.racks.get(design.templateId);
  const top = (p: Placement) => {
    if (p.mount.kind !== 'rack') return -Infinity;
    const d = placedDevice(lib, design, p);
    return p.mount.position + (d && rack ? Math.max(1, unitsIn(d.height, rack.unitSystem)) : 1) - 1;
  };
  return [...design.placements].sort((a, b) => top(b) - top(a));
}

/**
 * One device's face laid out like its faceplate: groups left to right, each filling column-major over its
 * rows; every port is split into its connector legs ("4x100G DR4 / MPO-12").
 */
function layoutDevice(lib: Library, design: RackDesign, p: Placement, face: PortFace, y0: number): DeviceLayout | undefined {
  const device = placedDevice(lib, design, p);
  if (!device) return undefined;
  const ports: PortBox[] = [];
  const legs: LegBox[] = [];
  const titles: DeviceLayout['titles'] = [];
  let x = LABEL_W;
  let bottom = 0;
  for (const g of groupsOnFace(device, deviceFaceSeenFrom(p, face))) {
    if (g.role === 'outlet') continue;
    const resolved = Array.from({ length: g.count }, (_, i) => resolvePlacedPort(lib, device, p, formatPortRef({ groupId: g.id, index: i + 1 })));
    const legList = resolved.map((r) => portLegs(g, r));
    const maxLegs = Math.max(1, ...legList.map((l) => l.length));
    // Every port of a group gets the same block size (the widest port's), so columns line up.
    const portW = PORT_PAD * 2 + maxLegs * LEG_W + (maxLegs - 1) * LEG_GAP;
    const h = PORT_HEAD + LEG_H + PORT_PAD;
    const rows = Math.max(1, g.rows);
    const cols = Math.ceil(g.count / rows);
    const top = y0 + PAD + TITLE_H;
    titles.push({ text: groupTitle(g), x, y: y0 + PAD + 9 });
    for (let i = 0; i < g.count; i++) {
      const px = x + Math.floor(i / rows) * (portW + GAP);
      const py = top + (i % rows) * (h + GAP);
      const portRef = formatPortRef({ groupId: g.id, index: i + 1 });
      ports.push({ group: g, index: i + 1, mode: resolved[i]?.mode ?? '', x: px, y: py, w: portW, h });
      legList[i].forEach((leg, k) => {
        legs.push({ ep: { placementId: p.id, portRef, connector: leg.index }, leg,
          x: px + PORT_PAD + k * (LEG_W + LEG_GAP), y: py + PORT_HEAD, w: LEG_W, h: LEG_H });
      });
      bottom = Math.max(bottom, py + h);
    }
    x += Math.max(cols * (portW + GAP) - GAP, groupTitle(g).length * 5.5) + GROUP_GAP;
  }
  return { p, device, y: y0, h: Math.max(bottom - y0 + PAD, 40), w: x, ports, legs, titles };
}

/**
 * Cabling view: every device's face drawn like its faceplate, each port split into its connector legs with
 * what runs on them. Press on a connector and drag to select several (dragging from a selected one deselects).
 * The selection splits into A (first device) and B (other devices); only cables that fit both ends are offered,
 * and the chosen one repeats in faceplate order.
 */
export function CablingView({ ref, lib, design, editor, face, onSelectCable }: Props) {
  const [selection, setSelection] = useState<CableEndpoint[]>([]);
  const [route, setRoute] = useState<CableRoute | 'auto'>('auto');
  const [mediaId, setMediaId] = useState('');
  const [message, setMessage] = useState<string>();
  const drag = useRef<{ adding: boolean } | undefined>(undefined);

  useEffect(() => {
    const up = () => { drag.current = undefined; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const used = usedConnectors(design);
  const runColor = new Map(design.cables.map((c) => [c.id, lib.cableMedia.get(c.mediaId)?.color ?? paint.inkMuted]));
  let y = 0;
  const devices: DeviceLayout[] = [];
  for (const p of rowOrder(lib, design)) {
    const l = layoutDevice(lib, design, p, face, y);
    if (!l) continue;
    devices.push(l);
    y += l.h + 4;
  }
  const order = new Map(devices.flatMap((d) => d.legs.map((l, i) => [endpointKey(l.ep), i] as const)));
  const selected = new Set(selection.map(endpointKey));

  // A/B split by device, each side in faceplate order so repeats pair 1↔1, 2↔2…
  const byFaceplate = (eps: CableEndpoint[]) => [...eps].sort((x, z) =>
    x.placementId === z.placementId ? (order.get(endpointKey(x)) ?? 0) - (order.get(endpointKey(z)) ?? 0) : 0);
  const split = splitSelection(selection);
  const a = byFaceplate(split.a);
  const b = byFaceplate(split.b);
  const cables = applicableCables(lib, design, a, b);
  const media = cables.find((c) => c.id === mediaId) ?? cables[0];
  const plan = selection.length && media ? planCable(lib, design, a, b, media.id, route) : undefined;

  const setSel = (ep: CableEndpoint, on: boolean) => {
    const key = endpointKey(ep);
    if (used.has(key)) return;
    setSelection((cur) => {
      const has = cur.some((e) => endpointKey(e) === key);
      if (on && !has) return [...cur, ep];
      if (!on && has) return cur.filter((e) => endpointKey(e) !== key);
      return cur;
    });
  };
  const down = (ep: CableEndpoint, e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setMessage(undefined);
    const runId = used.get(endpointKey(ep));
    if (runId) { onSelectCable(runId); return; }
    const adding = !selected.has(endpointKey(ep));
    drag.current = { adding };
    setSel(ep, adding);
  };
  const enter = (ep: CableEndpoint) => { if (drag.current) setSel(ep, drag.current.adding); };

  const assign = () => {
    if (!plan || plan.error) return;
    const last = editor.addCables(plan.runs).at(-1);
    setMessage(`${plan.runs.length} cable${plan.runs.length > 1 ? 's' : ''} assigned`);
    setSelection([]);
    onSelectCable(last);
  };

  const width = Math.max(600, ...devices.map((d) => d.w)) + 10;
  const height = Math.max(y, 40);

  return (
    <div className="cabling-view">
      <div className="cabling-bar">
        <SelectField label={`Cable (${cables.length} fit)`} value={media?.id ?? ''}
          options={cables.length ? cables.map((m) => ({ value: m.id, label: m.name })) : [{ value: '', label: 'No cable fits the selection' }]}
          disabled={!cables.length} onChange={setMediaId} />
        <SelectField<CableRoute | 'auto'> label="Route" value={route}
          options={[{ value: 'auto', label: 'auto (shorter)' }, { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' }]}
          onChange={setRoute} />
        <span className="muted">{`A ${a.length} · B ${b.length}`}</span>
        <Button variant="primary" disabled={!plan || !!plan.error} onClick={assign}>
          {plan && !plan.error ? `Assign ${plan.runs.length} cable${plan.runs.length > 1 ? 's' : ''}` : 'Assign'}
        </Button>
        <Button disabled={!selection.length} onClick={() => setSelection([])}>Clear</Button>
        {plan?.error && <span className="warn">{plan.error}</span>}
        {message && !selection.length && <span className="muted">{message}</span>}
      </div>
      <p className="muted">Press on a connector and drag to select several; drag from a selected one to deselect. A = first device selected, B = the others; the cable repeats in port order. Click a cabled connector to open its run.</p>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing" style={{ touchAction: 'none' }}>
        <rect width={width} height={height} fill={paint.paper} />
        {devices.length === 0 && <text x={10} y={24} fontSize={12} fill={paint.inkMuted}>No devices placed.</text>}
        {devices.map((d) => {
          const side = a.some((e) => e.placementId === d.p.id) ? 'A' : b.some((e) => e.placementId === d.p.id) ? 'B' : undefined;
          return (
            <g key={d.p.id}>
              <rect x={2} y={d.y} width={width - 4} height={d.h} rx={4} fill="#1e293b" stroke={side ? paint.selection : '#475569'} strokeWidth={side ? 2 : 1} />
              <text x={8} y={d.y + 17} fontSize={12} fontWeight={700} fill="#f8fafc">{`${side ? `[${side}] ` : ''}${d.p.label}`}</text>
              <text x={8} y={d.y + 30} fontSize={9} fill="#cbd5e1">
                <title>{d.device.name}</title>
                {d.device.name.length > 24 ? `${d.device.name.slice(0, 23)}…` : d.device.name}
              </text>
              {d.legs.length === 0 && <text x={LABEL_W} y={d.y + 24} fontSize={10} fill="#94a3b8">{`no ${face}-side ports`}</text>}
              {d.titles.map((t) => <text key={`${t.x}`} x={t.x} y={t.y} fontSize={9} fontWeight={600} fill="#e2e8f0">{t.text}</text>)}
              {d.ports.map((pt) => (
                <g key={`${pt.group.id}/${pt.index}`}>
                  <title>{`${pt.group.formFactor} ${pt.index} · ${pt.mode}`}</title>
                  <rect x={pt.x} y={pt.y} width={pt.w} height={pt.h} rx={2} fill="#0f172a" stroke="#475569" />
                  <text x={pt.x + pt.w / 2} y={pt.y + 9} fontSize={9} fontWeight={700} textAnchor="middle" fill="#e2e8f0">{pt.index}</text>
                </g>
              ))}
              {d.legs.map(({ ep, leg, x, y: ly, w, h }) => {
                const key = endpointKey(ep);
                const runId = used.get(key);
                const sel = selected.has(key);
                const fill = runId ? runColor.get(runId) : sel ? paint.selection : '#334155';
                const ink = runId || sel ? '#0f172a' : '#e2e8f0';
                // Three lines: lanes, reach, connector; missing lines are skipped, the rest stay centred.
                const lines = [leg.mode, leg.reach, leg.connector].filter((s): s is string => !!s);
                const cx = x + w / 2;
                const y0 = ly + h / 2 - ((lines.length - 1) * 9) / 2 + 3;
                return (
                  <g key={key} style={{ cursor: runId ? 'pointer' : 'cell' }} onPointerDown={(e) => down(ep, e)} onPointerEnter={() => enter(ep)}>
                    <title>{`${endpointLabel(design, ep)} · ${leg.label}${runId ? ' · cabled (click to open run)' : ''}`}</title>
                    <rect x={x} y={ly} width={w} height={h} rx={2} fill={fill} stroke={sel ? '#fff' : '#0f172a'} strokeWidth={sel ? 1.5 : 1} />
                    {lines.map((s, k) => {
                      const size = Math.min(8, (w - 4) / Math.max(1, s.length * 0.58));
                      return (
                        <text key={k} x={cx} y={y0 + k * 9} fontSize={size} fontWeight={k === 0 ? 700 : 500} textAnchor="middle"
                          fill={ink} opacity={k === 0 ? 1 : 0.85} pointerEvents="none">{s}</text>
                      );
                    })}
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
