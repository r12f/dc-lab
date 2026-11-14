import type { Library } from '../library/library';
import type { PortFace } from '../device/types';
import { cableGroupsOnFace, findGroup, formatPortRef } from '../device/ports';
import { endpointLegs } from './connectors';
import { estimateLengthM } from './cabling';
import type { CableEndpoint, CableRoute, CableRun, Placement, RackDesign } from './types';
import type { CableMedia } from '../optics/types';
import { connectorsMate } from '../optics/connectors';
import { isDirectAttach } from '../optics/cable-types';
import { fiberTypeFor } from '../ports/optic-match';
import { portLegs, type PortLeg } from '../ports/legs';
import { parsePortRef } from '../device/ports';
import { resolvePlacedPort } from './optics';

/** Stable key of a connector endpoint ("p1|osfp/3|2"). */
export function endpointKey(ep: CableEndpoint): string {
  return `${ep.placementId}|${ep.portRef}|${ep.connector ?? ''}`;
}

/** Device face whose ports are seen from rack face `face`: a rear-mounted device shows its rear ports at the front. */
export function deviceFaceSeenFrom(placement: Placement, face: PortFace): PortFace {
  if (placement.mount.kind === 'rack' && placement.mount.face === 'rear') return face === 'front' ? 'rear' : 'front';
  return face;
}

/** Every cable connector (leg) of a placement visible from a rack face, in faceplate order. Ports without a cable connector give one port-level endpoint. */
export function placementConnectors(lib: Library, design: RackDesign, placement: Placement, face: PortFace): CableEndpoint[] {
  const device = lib.devices.get(placement.deviceId);
  if (!device) return [];
  const out: CableEndpoint[] = [];
  for (const g of cableGroupsOnFace(device, deviceFaceSeenFrom(placement, face))) {
    for (let i = 1; i <= g.count; i++) {
      const portRef = formatPortRef({ groupId: g.id, index: i });
      const legs = endpointLegs(lib, design, placement.id, portRef);
      if (!legs) out.push({ placementId: placement.id, portRef });
      else for (let c = 1; c <= legs.count; c++) out.push({ placementId: placement.id, portRef, connector: c });
    }
  }
  return out;
}

/** endpointKey -> run id for every connector already used by a run. */
export function usedConnectors(design: RackDesign): Map<string, string> {
  const used = new Map<string, string>();
  for (const c of design.cables) for (const ep of [...c.from, ...c.to]) if (ep.portRef) used.set(endpointKey(ep), c.id);
  return used;
}

/**
 * Splits a connector selection into A and B ends: A = the connectors of the first selected device, B = the
 * rest (in selection order). A selection on a single device is split in halves (first half A).
 */
export function splitSelection(selection: CableEndpoint[]): { a: CableEndpoint[]; b: CableEndpoint[] } {
  const first = selection[0]?.placementId;
  const a = selection.filter((e) => e.placementId === first);
  const b = selection.filter((e) => e.placementId !== first);
  if (b.length > 0) return { a, b };
  const half = Math.ceil(a.length / 2);
  return { a: a.slice(0, half), b: a.slice(half) };
}

export interface AssignmentPlan {
  runs: Omit<CableRun, 'id'>[];
  error?: string;
}

/**
 * Repeats one cable over the selected connectors: A ends taken `ends.a.count` at a time, B ends
 * `ends.b.count` at a time, paired in order (A1..A10 + B1..B10 with a duplex cable = 10 runs).
 * Route `auto` picks the side giving the shorter estimate per run.
 */
export function planAssignments(
  lib: Library, design: RackDesign, a: CableEndpoint[], b: CableEndpoint[], mediaId: string, route: CableRoute | 'auto',
): AssignmentPlan {
  const media = lib.cableMedia.get(mediaId);
  if (!media) return { runs: [], error: 'Pick a cable' };
  if (a.length === 0 || b.length === 0) return { runs: [], error: 'Select connectors on both ends' };
  const na = media.ends.a.count;
  const nb = media.ends.b.count;
  if (a.length % na !== 0) return { runs: [], error: `${a.length} A connectors is not a multiple of ${na} (cable A end)` };
  if (b.length % nb !== 0) return { runs: [], error: `${b.length} B connectors is not a multiple of ${nb} (cable B end)` };
  if (a.length / na !== b.length / nb) {
    return { runs: [], error: `${a.length / na} cable(s) on A but ${b.length / nb} on B` };
  }
  const used = usedConnectors(design);
  const taken = [...a, ...b].find((e) => used.has(endpointKey(e)));
  if (taken) return { runs: [], error: `${taken.portRef}${taken.connector ? `.${taken.connector}` : ''} is already connected` };
  const runs: Omit<CableRun, 'id'>[] = [];
  for (let i = 0; i < a.length / na; i++) {
    const from = a.slice(i * na, i * na + na);
    const to = b.slice(i * nb, i * nb + nb);
    const side = route === 'auto' ? shorterRoute(lib, design, from, to) : route;
    runs.push({ from, to, route: side, mediaId, quantity: 1 });
  }
  return { runs };
}

/** Leg of an endpoint (the physical connector and what runs on it). */
export function endpointLeg(lib: Library, design: RackDesign, ep: CableEndpoint): PortLeg | undefined {
  const p = design.placements.find((x) => x.id === ep.placementId);
  const d = p && lib.devices.get(p.deviceId);
  const ref = parsePortRef(ep.portRef);
  const g = d && ref && findGroup(d, ref.groupId);
  if (!p || !d || !g) return undefined;
  const legs = portLegs(g, resolvePlacedPort(lib, d, p, ep.portRef));
  return ep.connector ? legs[ep.connector - 1] : legs[0];
}

/** True when a cable end fits a leg: connector mates; fiber type matches the reach; direct-attach speed matches. */
function endFits(media: CableMedia, side: 'a' | 'b', leg: PortLeg | undefined): boolean {
  if (!leg) return false;
  const end = media.ends[side];
  if (!connectorsMate(end.connector, leg.connector)) return false;
  if (isDirectAttach(media.type)) return !media.speedGbps || !leg.portGbps || media.speedGbps === leg.portGbps;
  const fiber = fiberTypeFor(leg.reach);
  return !fiber || !media.type.startsWith('fiber') || media.type === fiber;
}

export interface CablePlan extends AssignmentPlan {
  /** True when the cable runs B→A over the selection (its A end on the selection's B side). */
  reversed?: boolean;
}

/**
 * Plan for one cable over the selection: tried as A→B, then reversed (e.g. an MPO→4xLC breakout selected
 * LC side first). Errors when the cable's ends do not fit the selected connectors.
 */
export function planCable(lib: Library, design: RackDesign, a: CableEndpoint[], b: CableEndpoint[], mediaId: string, route: CableRoute | 'auto'): CablePlan {
  const media = lib.cableMedia.get(mediaId);
  if (!media) return { runs: [], error: 'Pick a cable' };
  const fits = (x: CableEndpoint[], y: CableEndpoint[]) =>
    x.every((e) => endFits(media, 'a', endpointLeg(lib, design, e))) && y.every((e) => endFits(media, 'b', endpointLeg(lib, design, e)));
  if (fits(a, b)) {
    const p = planAssignments(lib, design, a, b, mediaId, route);
    if (!p.error || !fits(b, a)) return p;
  }
  if (fits(b, a)) {
    const p = planAssignments(lib, design, b, a, mediaId, route);
    return { ...p, reversed: true };
  }
  return { runs: [], error: `${media.name} does not fit the selected connectors` };
}

/** Cables that can be assigned over the selection (all cables when nothing is selected). */
export function applicableCables(lib: Library, design: RackDesign, a: CableEndpoint[], b: CableEndpoint[]): CableMedia[] {
  const all = lib.cableMedia.items();
  if (a.length === 0 && b.length === 0) return all;
  // One end selected so far (e.g. a PSU inlet): cables with an end that fits it, so the list never goes empty
  // before the other end is picked.
  if (a.length === 0 || b.length === 0) {
    const legs = [...a, ...b].map((e) => endpointLeg(lib, design, e));
    return all.filter((m) => (['a', 'b'] as const).some((s) => legs.every((l) => endFits(m, s, l))));
  }
  return all.filter((m) => !planCable(lib, design, a, b, m.id, 'left').error);
}

function shorterRoute(lib: Library, design: RackDesign, from: CableEndpoint[], to: CableEndpoint[]): CableRoute {
  const l = estimateLengthM(lib, design, { from, to, route: 'left' }) ?? Infinity;
  const r = estimateLengthM(lib, design, { from, to, route: 'right' }) ?? Infinity;
  return r < l ? 'right' : 'left';
}
