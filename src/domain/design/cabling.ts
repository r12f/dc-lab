import type { Library } from '../library/library';
import type { RackTemplate } from '../rack/types';
import { elementsOn, isInternal } from '../rack/side-elements';
import { UNIT_MM, unitsIn } from '../units';
import type { CableEndpoint, CableRoute, CableRun, RackDesign } from './types';
import { placedDevice } from './sizing';
import { parsePortRef } from '../device/ports';

/** Slack for bend radius at both ends; rounding up to ROUND_M adds the rest (0.5 m slack on top double-counted it). */
const SLACK_M = 0.2;
const ROUND_M = 0.5;

/** Physical position of an endpoint: height above the rack floor (mm) and horizontal distance to each channel (mm). */
interface EndpointPos {
  heightMm: number;
  toChannelMm: Record<CableRoute, number>;
}

function endpointPos(lib: Library, design: RackDesign, rack: RackTemplate, ep: CableEndpoint): EndpointPos | undefined {
  const p = design.placements.find((x) => x.id === ep.placementId);
  const d = p && placedDevice(lib, design, p);
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
  // A vertical PDU's outlets run down the strip in port order: an outlet sits at its own height, not the strip's middle.
  const outlets = d.ports.filter((g) => g.role === 'outlet');
  const ref = parsePortRef(ep.portRef);
  const og = ref && outlets.find((g) => g.id === ref.groupId);
  const nOut = outlets.reduce((n, g) => n + g.count, 0);
  const at = og && ref ? outlets.slice(0, outlets.indexOf(og)).reduce((n, g) => n + g.count, 0) + ref.index - 1 : undefined;
  const top = totalMm - (mount.slot - 1) * slotH;
  const heightMm = at !== undefined && nOut > 0 ? top - ((at + 0.5) / nOut) * slotH : top - slotH / 2;
  // Distance from the element centre to the body edge on its side, through nearer elements.
  const same = elementsOn(rack.sideElements, el.side);
  // Internal elements (PDU bays) sit inside the enclosure and add no distance for elements outside them.
  const inner = same.slice(0, same.indexOf(el)).filter((e) => !isInternal(e)).reduce((n, e) => n + e.widthMm, 0) + el.widthMm / 2;
  const toChannelMm: Record<CableRoute, number> = el.side === 'left'
    ? { left: inner, right: inner + rack.widthMm }
    : { right: inner, left: inner + rack.widthMm };
  return { heightMm, toChannelMm };
}

/** Estimated length of one cable of a run (m), to its farthest B end, rounded up to 0.5 m; undefined if an endpoint is missing. */
export function estimateLengthM(lib: Library, design: RackDesign, run: Pick<CableRun, 'from' | 'to' | 'route'>): number | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  const as = run.from.map((ep) => endpointPos(lib, design, rack, ep));
  const bs = run.to.map((ep) => endpointPos(lib, design, rack, ep));
  if (as.length === 0 || bs.length === 0 || [...as, ...bs].some((x) => !x)) return undefined;
  // A multi-connector cable is as long as its farthest A-B pair.
  const route = run.route;
  const mm = Math.max(...as.flatMap((a) => bs.map((b) => a!.toChannelMm[route] + b!.toChannelMm[route] + Math.abs(a!.heightMm - b!.heightMm))));
  return Math.ceil((mm / 1000 + SLACK_M) / ROUND_M) * ROUND_M;
}

/** Length used for the BOM: manual if set, else the estimate (0 when it cannot be estimated). */
export function effectiveLengthM(lib: Library, design: RackDesign, run: CableRun): number {
  return run.lengthM ?? estimateLengthM(lib, design, run) ?? 0;
}
