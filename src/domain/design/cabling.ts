import type { Library } from '../library/Library';
import type { RackTemplate } from '../rack/types';
import { elementsOn } from '../rack/sideElements';
import { UNIT_MM, unitsIn } from '../units';
import type { CableEndpoint, CableRoute, CableRun, RackDesign } from './types';

const SLACK_M = 0.5;
const ROUND_M = 0.5;

/** Physical position of an endpoint: height above the rack floor (mm) and horizontal distance to each channel (mm). */
interface EndpointPos {
  heightMm: number;
  toChannelMm: Record<CableRoute, number>;
}

function endpointPos(lib: Library, design: RackDesign, rack: RackTemplate, ep: CableEndpoint): EndpointPos | undefined {
  const p = design.placements.find((x) => x.id === ep.placementId);
  const d = p && lib.devices.get(p.deviceId);
  if (!p || !d) return undefined;
  const unitMm = UNIT_MM[rack.unitSystem];
  const totalMm = rack.units * unitMm;
  const half = rack.widthMm / 2;
  if (p.mount.kind === 'rack') {
    const units = Math.max(1, unitsIn(d.height, rack.unitSystem));
    return { heightMm: (p.mount.position - 1 + units / 2) * unitMm, toChannelMm: { left: half, right: half } };
  }
  const mount = p.mount;
  const el = rack.sideElements.find((e) => e.id === mount.elementId);
  if (!el) return undefined;
  const slotH = totalMm / Math.max(1, el.slots);
  const heightMm = totalMm - (mount.slot - 0.5) * slotH;
  // Distance from the element centre to the body edge on its side, through nearer elements.
  const same = elementsOn(rack.sideElements, el.side);
  const inner = same.slice(0, same.indexOf(el)).reduce((n, e) => n + e.widthMm, 0) + el.widthMm / 2;
  const toChannelMm: Record<CableRoute, number> = el.side === 'left'
    ? { left: inner, right: inner + rack.widthMm }
    : { right: inner, left: inner + rack.widthMm };
  return { heightMm, toChannelMm };
}

/** Estimated length of one cable of a run (m), rounded up to 0.5 m; undefined if an endpoint is missing. */
export function estimateLengthM(lib: Library, design: RackDesign, run: Pick<CableRun, 'from' | 'to' | 'route'>): number | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  const a = endpointPos(lib, design, rack, run.from);
  const b = endpointPos(lib, design, rack, run.to);
  if (!a || !b) return undefined;
  const mm = a.toChannelMm[run.route] + b.toChannelMm[run.route] + Math.abs(a.heightMm - b.heightMm);
  return Math.ceil((mm / 1000 + SLACK_M) / ROUND_M) * ROUND_M;
}

/** Length used for the BOM: manual if set, else the estimate (0 when it cannot be estimated). */
export function effectiveLengthM(lib: Library, design: RackDesign, run: CableRun): number {
  return run.lengthM ?? estimateLengthM(lib, design, run) ?? 0;
}
