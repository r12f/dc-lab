import { genderedConnector } from '../../domain/optics/connectors';
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, Placement, RackDesign } from '../../domain/design/types';
import type { DeviceDefinition, PortFace, PortGroup } from '../../domain/device/types';
import { applicableCables, deviceFaceSeenFrom, endpointKey, planCable, splitSelection, usedConnectors } from '../../domain/design/cable-assign';
import { endpointLabel } from '../../domain/design/connectors';
import { resolvePlacedPort } from '../../domain/design/optics';
import { cableGroupsOnFace, drawOrder, faceRows, formatPortRef, groupCols, portCell, portName } from '../../domain/device/ports';
import { portLegs, type PortLeg } from '../../domain/ports/legs';
import { groupTitle } from '../devices/drawing/group-title';
import { unitsIn } from '../../domain/units';
import { placedDevice } from '../../domain/design/sizing';
import { categoryStyle, paint } from '../../theme/paint';
import { Button } from '../../ui/button';
import { SelectField } from '../../ui/fields';
import type { DesignEditor } from './use-design-editor';
import type { SideName } from '../../domain/rack/side-elements';
import { memoByDesign } from '../../domain/design/memo';
import { visibleDesign, type ViewFilter } from '../../domain/design/device-filter';
import { crossRackKeys, toggleCrossRack } from '../../domain/design/cross-rack';
import { focusedRuns, routeCablingLines, type CablingFace, type CablingLine, type LegAnchor } from './cabling-lines';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  /** Run selected in the inspector / by clicking: its lines and connectors are highlighted. */
  selectedCableId?: string;
  onSelectCable(id: string | undefined): void;
  /** Placement ids not drawn (device filter); links touching them are not drawn either. */
  /** Device / cable-type filter (drawing only). */
  filter?: ViewFilter;
  /** Faces shown (default both). */
  faces?: readonly PortFace[];
}

/**
 * Port block: the port number on top, its connector legs side by side below, each a three-line cable block
 * (lanes / reach / connector, e.g. "4x200G", "DR4", "MPO-8"). Sized to stay compact so a 64-port face fits.
 */
const PORT_HEAD = 11;
const LEG_W = 42;
const LEG_H = 32;
const LEG_GAP = 2;
const PORT_PAD = 2;

const GAP = 3;
const GROUP_GAP = 14;
const PAD = 6;
const LABEL_W = 120;
const TITLE_H = 13;
/** Space between the front block and the rear block. */
const BLOCK_GAP = 12;
/** Height of the FRONT / REAR headings above the devices. */
const SECTION_H = 22;
/** Ports per line on a side-mounted (vertical) device. */
const SIDE_COLS = 2;
/** Width of each cable channel: front and rear each have their own left and right channel. */
const CHANNEL_W = 100;
/** y of the band above the devices where front-rear runs cross between the two face blocks. */
const BAND_Y = SECTION_H - 3;
/** Gap between device rows: cables run along it to their channel. */
const ROW_GAP = 10;

interface LegBox { ep: CableEndpoint; leg: PortLeg; x: number; y: number; w: number; h: number }
interface PortBox { group: PortGroup; index: number; mode: string; x: number; y: number; w: number; h: number }
interface DeviceLayout {
  p: Placement; device: DeviceDefinition; face: PortFace; x: number; y: number; h: number; w: number;
  ports: PortBox[]; legs: LegBox[]; titles: { text: string; x: number; y: number }[];
}

/** Rack-mounted devices top to bottom (highest top unit first). */
function rackOrder(lib: Library, design: RackDesign) {
  const rack = lib.racks.get(design.templateId);
  const top = (p: Placement) => {
    if (p.mount.kind !== 'rack') return -Infinity;
    const d = placedDevice(lib, design, p);
    return p.mount.position + (d && rack ? Math.max(1, unitsIn(d.height, rack.unitSystem)) : 1) - 1;
  };
  return design.placements.filter((p) => p.mount.kind === 'rack' && hasCablePorts(lib, design, p)).sort((a, b) => top(b) - top(a));
}

/** Devices with no cable ports on either face (blanking panels, reserved space…) are left out of the cabling view. */
function hasCablePorts(lib: Library, design: RackDesign, p: Placement): boolean {
  const d = placedDevice(lib, design, p);
  return !!d && (cableGroupsOnFace(d, 'front').length > 0 || cableGroupsOnFace(d, 'rear').length > 0);
}

/** Side-mounted devices (vertical PDUs) on one side of the rack, top slot first — as in the elevation. */
function sideOrder(lib: Library, design: RackDesign, side: SideName) {
  const rack = lib.racks.get(design.templateId);
  const elOf = (p: Placement) => (p.mount.kind === 'side' ? rack?.sideElements.find((e) => e.id === (p.mount as { elementId: string }).elementId) : undefined);
  return design.placements
    .filter((p) => elOf(p)?.side === side)
    .sort((a, b) => (rack?.sideElements.indexOf(elOf(a)!) ?? 0) - (rack?.sideElements.indexOf(elOf(b)!) ?? 0)
      || (a.mount as { slot: number }).slot - (b.mount as { slot: number }).slot);
}

/**
 * One device's face laid out like its faceplate: groups left to right, each filling column-major over its
 * rows; every port is split into its connector legs ("4x100G DR4 / MPO-12"). A vertical device (side-mounted
 * PDU) stacks its groups top to bottom, `SIDE_COLS` ports wide, under its label. Coordinates start at (x0, y0);
 * `w` / `h` are the device box's own size (it shrinks to its ports).
 */
function layoutDevice(lib: Library, design: RackDesign, p: Placement, face: PortFace | 'all', x0: number, y0: number, vertical = false): DeviceLayout | undefined {
  const device = placedDevice(lib, design, p);
  if (!device) return undefined;
  const ports: PortBox[] = [];
  const legs: LegBox[] = [];
  const titles: DeviceLayout['titles'] = [];
  const groups = face === 'all'
    ? [...faceRows(drawOrder(cableGroupsOnFace(device, 'front'))).flat(), ...faceRows(drawOrder(cableGroupsOnFace(device, 'rear'))).flat()]
    : faceRows(drawOrder(cableGroupsOnFace(device, deviceFaceSeenFrom(p, face)))).flat();
  let x = x0 + (vertical ? PAD : LABEL_W);
  let gy = y0 + (vertical ? 34 : 0);
  let bottom = y0 + 34;
  let right = x0 + LABEL_W;
  // Face rows (`faceRow`): a group starting a new row goes back to the left edge, under everything drawn so far.
  let row0 = groups[0]?.faceRow ?? 0;
  for (const g of groups) {
    if (!vertical && (g.faceRow ?? 0) !== row0) {
      row0 = g.faceRow ?? 0;
      x = x0 + LABEL_W;
      gy = bottom - PAD + GAP;
    }
    const resolved = Array.from({ length: g.count }, (_, i) => resolvePlacedPort(lib, device, p, formatPortRef({ groupId: g.id, index: i + 1 })));
    const legList = resolved.map((r) => portLegs(g, r));
    const maxLegs = Math.max(1, ...legList.map((l) => l.length));
    // Stacked connectors (housing slots) sit one above the other, connector 1 at the bottom.
    const stacked = g.connectorLayout === 'stacked' && maxLegs > 1;
    const across = stacked ? 1 : maxLegs;
    const down = stacked ? maxLegs : 1;
    // Every port of a group gets the same block size (the widest port's), so columns line up.
    const portW = PORT_PAD * 2 + across * LEG_W + (across - 1) * LEG_GAP;
    const h = PORT_HEAD + down * LEG_H + (down - 1) * LEG_GAP + PORT_PAD;
    // Vertical: SIDE_COLS ports per line, filled row-major top to bottom.
    const rows = vertical ? Math.ceil(g.count / SIDE_COLS) : Math.max(1, g.rows);
    const cols = vertical ? Math.ceil(g.count / rows) : groupCols(g, rows);
    const top = gy + PAD + TITLE_H;
    titles.push({ text: groupTitle(g), x, y: gy + PAD + 9 });
    for (let i = 0; i < g.count; i++) {
      const cell = portCell(g, i, rows);
      const [col, row] = vertical ? [i % SIDE_COLS, Math.floor(i / SIDE_COLS)] : [cell.col, cell.row];
      const px = x + col * (portW + GAP);
      const py = top + row * (h + GAP);
      const portRef = formatPortRef({ groupId: g.id, index: i + 1 });
      ports.push({ group: g, index: i + 1, mode: resolved[i]?.mode ?? '', x: px, y: py, w: portW, h });
      legList[i].forEach((leg, k) => {
        legs.push({ ep: { placementId: p.id, portRef, connector: leg.index }, leg,
          x: px + PORT_PAD + (stacked ? 0 : k * (LEG_W + LEG_GAP)),
          y: py + PORT_HEAD + (stacked ? (down - 1 - k) * (LEG_H + LEG_GAP) : 0), w: LEG_W, h: LEG_H });
      });
      bottom = Math.max(bottom, py + h);
      right = Math.max(right, px + portW);
    }
    const groupW = Math.max(cols * (portW + GAP) - GAP, groupTitle(g).length * 5.5);
    right = Math.max(right, x + groupW);
    if (vertical) gy = bottom + 2;
    else x += groupW + GROUP_GAP;
  }
  return { p, device, face: face === 'all' ? 'front' : face, x: x0, y: y0, h: Math.max(bottom - y0 + PAD, 40), w: right - x0 + PAD, ports, legs, titles };
}

interface CablingLayout {
  used: Map<string, string>;
  cross: Set<string>;
  runColor: Map<string, string>;
  devices: DeviceLayout[];
  leftSide: DeviceLayout[];
  rightSide: DeviceLayout[];
  legOrder: Map<string, number>;
  /** endpointKey -> connector, for event delegation and tooltips. */
  epByKey: Map<string, LegBox>;
  lines: CablingLine[];
  faces: readonly PortFace[];
  leftX: number; frontX: number; rearX: number; rightX: number;
  width: number; height: number;
  channels: Record<CablingFace, { left: number; right: number; width: number }>;
}

/** Everything the drawing needs that depends only on the design (not on the selection); cached per design snapshot. */
const FACE_SETS: Record<string, readonly PortFace[]> = { both: ['front', 'rear'], front: ['front'], rear: ['rear'] };
const cablingLayouts = Object.fromEntries(Object.entries(FACE_SETS).map(([k, f]) => [k, memoByDesign((lib, d) => computeCablingLayout(lib, d, f))]));
const cablingLayout = (lib: Library, design: RackDesign, faces: readonly PortFace[]) =>
  cablingLayouts[faces.length === 1 ? faces[0] : 'both'](lib, design);

function computeCablingLayout(lib: Library, design: RackDesign, faces: readonly PortFace[]): CablingLayout {
  const showFront = faces.includes('front');
  const showRear = faces.includes('rear');
  const used = usedConnectors(design);
  const cross = crossRackKeys(design);
  const runColor = new Map(design.cables.map((c) => [c.id, lib.cableMedia.get(c.mediaId)?.color ?? paint.inkMuted]));
  // FRONT | REAR with the PDU bays (rear side): left side PDUs | rear devices | right side PDUs.
  // Rack devices line up across front and rear (same row); each box shrinks to its own ports.
  const shift = (d: DeviceLayout, dx: number) => {
    d.x += dx;
    d.ports.forEach((pt) => { pt.x += dx; });
    d.legs.forEach((l) => { l.x += dx; });
    d.titles.forEach((t) => { t.x += dx; });
  };
  const stackSide = (side: SideName) => {
    const out: DeviceLayout[] = [];
    let sy = SECTION_H;
    for (const p of sideOrder(lib, design, side)) {
      const l = layoutDevice(lib, design, p, 'all', 0, sy, true);
      if (!l) continue;
      out.push(l);
      sy += l.h + ROW_GAP;
    }
    return out;
  };
  // Side PDUs are on the rear: drawn only with the rear block.
  const leftSide = showRear ? stackSide('left') : [];
  const rightSide = showRear ? stackSide('right') : [];
  const sideW = (xs: DeviceLayout[]) => (xs.length ? Math.max(...xs.map((d) => d.w)) + 8 : 0);
  const leftW = sideW(leftSide);
  // Columns: ch | FRONT | ch || left PDUs | ch | REAR | ch | right PDUs.
  const frontX = CHANNEL_W;
  const front: DeviceLayout[] = [];
  const rear: DeviceLayout[] = [];
  let y = SECTION_H;
  for (const p of rackOrder(lib, design)) {
    const f = showFront ? layoutDevice(lib, design, p, 'front', frontX, y) : undefined;
    const r = showRear ? layoutDevice(lib, design, p, 'rear', 0, y) : undefined;
    if ((showFront && !f) || (showRear && !r)) continue;
    if (f) front.push(f);
    if (r) rear.push(r);
    y += Math.max(f?.h ?? 0, r?.h ?? 0) + ROW_GAP;
  }
  const frontW = showFront ? Math.max(240, ...front.map((d) => d.w)) + 8 : 0;
  // PDU bays are on the rear: the side PDUs flank the rear block (which starts at the left edge when alone).
  const leftX = showFront ? frontX + frontW + CHANNEL_W + BLOCK_GAP : 0;
  leftSide.forEach((d) => shift(d, leftX));
  const rearX = leftX + leftW + CHANNEL_W;
  rear.forEach((d) => shift(d, rearX));
  const rearW = showRear ? Math.max(240, ...rear.map((d) => d.w)) + 8 : 0;
  const rightX = rearX + rearW + CHANNEL_W;
  rightSide.forEach((d) => shift(d, rightX));
  const devices = [...leftSide, ...front, ...rear, ...rightSide];
  const legOrder = new Map(devices.flatMap((d) => d.legs.map((l, i) => [endpointKey(l.ep), i + (d.face === 'rear' ? 100000 : 0)] as const)));
  const width = showRear ? rightX + sideW(rightSide) : frontX + frontW + CHANNEL_W;
  const channels = {
    front: { left: frontX - CHANNEL_W, right: frontX + frontW, width: CHANNEL_W },
    rear: { left: rearX - CHANNEL_W, right: rearX + rearW, width: CHANNEL_W },
  };
  const anchors = new Map<string, LegAnchor>();
  const epByKey = new Map<string, LegBox>();
  // Side PDUs sit in the rear block and use its channels.
  const blockOf = (d: DeviceLayout): CablingFace => (leftSide.includes(d) || rightSide.includes(d) ? 'rear' : d.face);
  for (const d of devices) {
    for (const l of d.legs) {
      const k = endpointKey(l.ep);
      epByKey.set(k, l);
      // Every cable drops just below its own connector, then runs sideways to the channel (never across other ports).
      // Lines end at the connector's bottom edge, so they never cover its label.
      anchors.set(k, { x: l.x + l.w / 2, y: l.y + l.h, gapAbove: d.y - ROW_GAP / 2, gapBelow: d.y + d.h + ROW_GAP / 2, face: blockOf(d),
        exitY: l.y + l.h + 2 });
    }
  }
  const lines = routeCablingLines(design.cables, anchors, endpointKey, channels, BAND_Y);
  // Tall enough for every device and every routed line (lines below the last device turn in the gap under it).
  const height = Math.max(y, SECTION_H + 30, ...devices.map((d) => d.y + d.h + ROW_GAP),
    ...lines.flatMap((l) => l.points.map(([, py]) => py + 6)));
  return { faces, used, cross, runColor, devices, leftSide, rightSide, legOrder, epByKey, lines, leftX, frontX, rearX, rightX, width, height, channels };
}

/** One connector block: fill, outline and its three text lines (lanes / reach / connector). */
function LegBlock({ l, fill, ink, stroke, strokeWidth, cross }: { l: LegBox; fill: string; ink: string; stroke: string; strokeWidth: number; cross: boolean }) {
  const { leg, x, y, w, h } = l;
  const lines = [leg.mode, leg.reach, genderedConnector(leg.connector, leg.cableGender)].filter((s): s is string => !!s);
  const cx = x + w / 2;
  const y0 = y + h / 2 - ((lines.length - 1) * 9) / 2 + 3;
  return (
    <>
      <rect data-k={endpointKey(l.ep)} x={x} y={y} width={w} height={h} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {cross && <text x={x + w - 2} y={y + 8} fontSize={8} fontWeight={700} textAnchor="end" fill={ink} pointerEvents="none">⇄</text>}
      {lines.map((s, k) => (
        <text key={k} x={cx} y={y0 + k * 9} fontSize={Math.min(8, (w - 4) / Math.max(1, s.length * 0.58))} fontWeight={k === 0 ? 700 : 500}
          textAnchor="middle" fill={ink} opacity={k === 0 ? 1 : 0.85} pointerEvents="none">{s}</text>
      ))}
    </>
  );
}

/** Cross-rack connectors not yet cabled: a teal of their own, set off from the category colors. */
const CROSS_FILL = '#0e7490';
const legFill = (L: CablingLayout, k: string) => {
  const runId = L.used.get(k);
  return runId ? L.runColor.get(runId)! : L.cross.has(k) ? CROSS_FILL : paint.slot;
};
/** Text on a connector: dark on a cable color, white on cross-rack teal, the device's text color on an empty slot. */
const legInk = (L: CablingLayout, k: string, text: string) => (L.used.has(k) ? '#0f172a' : L.cross.has(k) ? '#ffffff' : text);

/**
 * The selection-independent drawing: device boxes, ports, connectors and cable lines. Memoized on the layout, so
 * selecting, dragging or highlighting never re-renders these thousands of elements; events are delegated
 * (`data-k` = connector key, `data-run` = run id).
 */
const CablingBase = memo(function CablingBase({ L }: { L: CablingLayout }) {
  return (
    <>
      {L.devices.map((d) => {
        // Same category colors as the rack elevation (theme-scheme aware): device block, ports on the paper color.
        const cs = categoryStyle(d.device.category);
        return (
          <g key={`${d.face}:${d.p.id}`}>
            <rect x={d.x + 2} y={d.y} width={d.w - 2} height={d.h} rx={4} fill={cs.fill} stroke={cs.stroke} />
            <text x={d.x + 8} y={d.y + 17} fontSize={12} fontWeight={700} fill={cs.text}>{d.p.label}</text>
            <text x={d.x + 8} y={d.y + 30} fontSize={9} fill={cs.text} opacity={0.8}>
              {d.device.name.length > 24 ? `${d.device.name.slice(0, 23)}…` : d.device.name}
            </text>
            {d.legs.length === 0 && <text x={d.x + 8} y={d.y + d.h - 4} fontSize={8} fill={cs.text} opacity={0.6}>{`no ${d.face} ports`}</text>}
            {d.titles.map((t) => <text key={`${t.x}`} x={t.x} y={t.y} fontSize={9} fontWeight={600} fill={cs.text}>{t.text}</text>)}
            {d.ports.map((pt) => (
              <g key={`${pt.group.id}/${pt.index}`}>
                <rect x={pt.x} y={pt.y} width={pt.w} height={pt.h} rx={2} fill={paint.paper} stroke={cs.stroke} />
                <text x={pt.x + pt.w / 2} y={pt.y + 9} fontSize={9} fontWeight={700} textAnchor="middle" fill={cs.text}>{portName(pt.group, pt.index)}</text>
              </g>
            ))}
            {d.legs.map((l) => {
              const k = endpointKey(l.ep);
              return <LegBlock key={k} l={l} fill={legFill(L, k)} ink={legInk(L, k, cs.text)} stroke={cs.stroke} strokeWidth={1} cross={L.cross.has(k)} />;
            })}
          </g>
        );
      })}
      {/* Assigned cables: one line per A-B connector pair, in the cable's colour. */}
      {L.lines.map((ln) => (
        <polyline key={ln.key} data-run={ln.runId} points={ln.points.map((pt) => pt.join(',')).join(' ')} fill="none"
          stroke={L.runColor.get(ln.runId)} strokeOpacity={0.85} strokeWidth={1.5} strokeLinejoin="round" style={{ cursor: 'pointer' }} />
      ))}
    </>
  );
});

/**
 * Cabling view: every device's face drawn like its faceplate, each port split into its connector legs with
 * what runs on them. Press on a connector and drag to select several (dragging from a selected one deselects).
 * The selection splits into A (first device) and B (other devices); only cables that fit both ends are offered,
 * and the chosen one repeats in faceplate order.
 */
const NO_FILTER: ViewFilter = { hiddenDevices: new Set(), hiddenCables: new Set() };
const BOTH: readonly PortFace[] = ['front', 'rear'];

export function CablingView({ ref, lib, design, editor, selectedCableId, onSelectCable, filter = NO_FILTER, faces = BOTH }: Props) {
  const [selection, setSelection] = useState<CableEndpoint[]>([]);
  const [route, setRoute] = useState<CableRoute | 'auto'>('auto');
  const [mediaId, setMediaId] = useState('');
  const [message, setMessage] = useState<string>();
  const drag = useRef<{ adding: boolean } | undefined>(undefined);
  const [hover, setHover] = useState<string>();

  useEffect(() => {
    const up = () => { drag.current = undefined; };
    // Escape clears the highlighted run and the selection (ignored while typing in a field).
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement | null)?.closest('input, select, textarea')) return;
      onSelectCable(undefined);
      setSelection([]);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); };
  }, [onSelectCable]);

  // Drawing uses the filtered design (stable object per filter, so the layout cache holds); edits use the full one.
  const shown = useMemo(() => visibleDesign(lib, design, filter), [lib, design, filter]);
  const L = cablingLayout(lib, shown, faces);
  const { used, cross, devices, legOrder, epByKey, leftSide, rightSide, leftX, frontX, rearX, rightX, width, height, channels } = L;
  const selected = new Set(selection.map(endpointKey));
  const focus = focusedRuns(design.cables, used, selected, selectedCableId);

  // A/B split by device, each side in faceplate order so repeats pair 1↔1, 2↔2…
  const byFaceplate = (eps: CableEndpoint[]) => [...eps].sort((x, z) =>
    x.placementId === z.placementId ? (legOrder.get(endpointKey(x)) ?? 0) - (legOrder.get(endpointKey(z)) ?? 0) : 0);
  const split = splitSelection(selection);
  const a = byFaceplate(split.a);
  const b = byFaceplate(split.b);
  const cables = applicableCables(lib, design, a, b);
  const media = cables.find((c) => c.id === mediaId) ?? cables[0];
  const plan = selection.length && media ? planCable(lib, design, a, b, media.id, route) : undefined;
  const aIds = new Set(a.map((e) => e.placementId));
  const bIds = new Set(b.map((e) => e.placementId));
  const sideOf = (id: string) => (aIds.has(id) ? 'A' : bIds.has(id) ? 'B' : undefined);

  const setSel = (ep: CableEndpoint, on: boolean) => {
    const key = endpointKey(ep);
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
    // Cabled connectors select like free ones (click toggles, drag extends); selecting one also opens its run.
    const runId = used.get(endpointKey(ep));
    const adding = !selected.has(endpointKey(ep));
    drag.current = { adding };
    setSel(ep, adding);
    if (runId) onSelectCable(adding ? runId : undefined);
  };
  const enter = (ep: CableEndpoint) => { if (drag.current) setSel(ep, drag.current.adding); };
  const target = (e: { target: EventTarget }) => (e.target as Element).closest('[data-k],[data-run]');
  const basePointerDown = (e: PointerEvent) => {
    const t = target(e);
    const k = t?.getAttribute('data-k');
    const run = t?.getAttribute('data-run');
    if (k) { const l = epByKey.get(k); if (l) down(l.ep, e); }
    else if (run) onSelectCable(run === selectedCableId ? undefined : run);
    else { onSelectCable(undefined); setSelection([]); }
  };
  const basePointerOver = (e: PointerEvent) => {
    const t = target(e);
    const k = t?.getAttribute('data-k');
    const run = t?.getAttribute('data-run');
    if (k) {
      const l = epByKey.get(k);
      if (l) enter(l.ep);
      const runId = used.get(k);
      setHover(l && `${endpointLabel(design, l.ep)} · ${l.leg.label}${runId ? ' · cabled' : ''}${cross.has(k) ? ' · cross-rack' : ''}`);
    } else if (run) {
      const c = design.cables.find((x) => x.id === run);
      setHover(c && `${c.from.map((x) => endpointLabel(design, x)).join(', ')} ↔ ${c.to.map((x) => endpointLabel(design, x)).join(', ')}`);
    } else setHover(undefined);
  };

  // Cross-rack: toggles the mark on the selection (all marked -> unmark, else mark all).
  const allCross = selection.length > 0 && selection.every((e) => cross.has(endpointKey(e)));
  const markCrossRack = () => {
    const r = toggleCrossRack(design, selection);
    if (r.error) { setMessage(r.error); return; }
    editor.setCrossRack(r.crossRack);
    setMessage(`${selection.length} connector${selection.length > 1 ? 's' : ''} ${allCross ? 'unmarked' : 'marked cross-rack'}`);
    setSelection([]);
  };

  const assign = () => {
    if (!plan || plan.error) return;
    const last = editor.addCables(plan.runs).at(-1);
    setMessage(`${plan.runs.length} cable${plan.runs.length > 1 ? 's' : ''} assigned`);
    setSelection([]);
    onSelectCable(last);
  };

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
        <Button disabled={!selection.length} onClick={markCrossRack}
          title="Cross-rack ports leave the rack: no in-rack cable; DC Layout assigns trunk cables to them">
          {allCross ? 'Unmark cross-rack' : 'Mark cross-rack'}
        </Button>
        <Button disabled={!selection.length} onClick={() => setSelection([])}>Clear</Button>
        {plan?.error && <span className="warn">{plan.error}</span>}
        {message && <span className="muted">{message}</span>}
        <span className="muted">{`${cross.size} cross-rack`}</span>
        {hover && <span className="muted">{hover}</span>}
      </div>
      <p className="muted">Front and rear side by side (power inlets and PDU outlets included). Press on a connector and drag to select several; drag from a selected one to deselect. A = first device selected, B = the others; the cable repeats in port order. Click a cabled connector to open its run.</p>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing" style={{ touchAction: 'none' }}>
        {/* Clicking empty space clears the highlighted run and the connector selection. */}
        <rect width={width} height={height} fill={paint.paper} onPointerDown={() => { onSelectCable(undefined); setSelection([]); }} />
        {leftSide.length > 0 && <text x={leftX + 4} y={14} fontSize={11} fontWeight={700} fill={paint.ink}>LEFT</text>}
        {L.faces.includes('front') && <text x={frontX + 4} y={14} fontSize={12} fontWeight={700} fill={paint.ink}>FRONT</text>}
        {L.faces.includes('rear') && <text x={rearX + 4} y={14} fontSize={12} fontWeight={700} fill={paint.ink}>REAR</text>}
        {rightSide.length > 0 && <text x={rightX + 4} y={14} fontSize={11} fontWeight={700} fill={paint.ink}>RIGHT</text>}
        {/* Each face block's own left / right cable channels. */}
        {L.faces.flatMap((f) => [channels[f].left, channels[f].right]).map((x) => (
          <g key={`ch${x}`}>
            <rect x={x} y={SECTION_H} width={CHANNEL_W} height={height - SECTION_H} fill={paint.inkMuted} fillOpacity={0.06} />
            <text x={x + CHANNEL_W / 2} y={height - 4} fontSize={8} textAnchor="middle" fill={paint.inkMuted}>cable channel</text>
          </g>
        ))}
        {/* Front block | rear block (with its PDU bays). */}
        {L.faces.length === 2 && <line x1={leftX - BLOCK_GAP / 2} y1={0} x2={leftX - BLOCK_GAP / 2} y2={height} stroke={paint.inkMuted} strokeDasharray="4 3" />}
        {devices.length === 0 && <text x={10} y={SECTION_H + 16} fontSize={12} fill={paint.inkMuted}>No devices placed.</text>}
        <g onPointerDown={basePointerDown} onPointerOver={basePointerOver} onPointerLeave={() => setHover(undefined)}>
          <CablingBase L={L} />
        </g>
        {/* Overlay (cheap, re-rendered on selection): veil over everything when runs are highlighted, then the
            highlighted runs, A/B device outlines and the selected connectors on top. */}
        <g pointerEvents="none">
          {focus.size > 0 && <rect width={width} height={height} fill={paint.paper} fillOpacity={0.6} />}
          {L.lines.filter((ln) => focus.has(ln.runId)).map((ln) => (
            <polyline key={ln.key} points={ln.points.map((pt) => pt.join(',')).join(' ')} fill="none"
              stroke={L.runColor.get(ln.runId)} strokeWidth={3.5} strokeLinejoin="round" />
          ))}
          {[...L.used].filter(([, r]) => focus.has(r)).map(([k]) => epByKey.get(k)).filter((l): l is LegBox => !!l).map((l) => {
            const k = endpointKey(l.ep);
            return <LegBlock key={`f${k}`} l={l} fill={legFill(L, k)} ink="#0f172a" stroke="#fff" strokeWidth={2} cross={cross.has(k)} />;
          })}
          {devices.filter((d) => sideOf(d.p.id)).map((d) => (
            <g key={`ab${d.face}:${d.p.id}`}>
              <rect x={d.x + 2} y={d.y} width={d.w - 2} height={d.h} rx={4} fill="none" stroke={paint.selection} strokeWidth={2} />
              <text x={d.x + 8} y={d.y + 17} fontSize={12} fontWeight={700} fill={paint.selection} dx={-2} dy={-20 + 9}>{`[${sideOf(d.p.id)}]`}</text>
            </g>
          ))}
          {selection.map((ep) => epByKey.get(endpointKey(ep))).filter((l): l is LegBox => !!l).map((l) => (
            <LegBlock key={`s${endpointKey(l.ep)}`} l={l} fill={paint.selection} ink="#0f172a" stroke="#fff" strokeWidth={2.5} cross={cross.has(endpointKey(l.ep))} />
          ))}
        </g>
      </svg>
    </div>
  );
}
