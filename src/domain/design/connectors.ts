import type { Library } from '../library/library';
import type { CableMedia } from '../optics/types';
import { portConnectors } from '../ports/optic-match';
import { resolvePlacedPort } from './optics';
import type { CableEndpoint, CableRun, RackDesign } from './types';

/** Connector legs of a port of a placed device: e.g. 2 x MPO-12 for a 2xDR4 module. */
export function endpointLegs(lib: Library, design: RackDesign, placementId: string, portRef: string) {
  const p = design.placements.find((x) => x.id === placementId);
  const d = p && lib.devices.get(p.deviceId);
  if (!p || !d || !portRef) return undefined;
  const r = resolvePlacedPort(lib, d, p, portRef);
  return r ? portConnectors(r.group, r.optic, r.reach) : undefined;
}

/** Connector at the A end and at each B end of a cable. */
export function cableEnds(media: CableMedia): { a: string; b: string; bLegs: number } {
  return { a: media.connector, b: media.breakout?.connector ?? media.connector, bLegs: media.breakout?.count ?? 1 };
}

const sameEnd = (x: CableEndpoint, y: CableEndpoint) =>
  x.placementId === y.placementId && x.portRef === y.portRef && !!x.portRef && (x.connector ?? 0) === (y.connector ?? 0) && !!x.connector;

/** Human-readable endpoint, e.g. "SW1 osfp/3.2" (leg 2 of port osfp/3). */
export function endpointLabel(design: RackDesign, ep: CableEndpoint): string {
  const p = design.placements.find((x) => x.id === ep.placementId);
  const port = ep.portRef ? ` ${ep.portRef}${ep.connector ? `.${ep.connector}` : ''}` : '';
  return `${p?.label ?? '?'}${port}`;
}

/** Problems with a run: connector mismatch, too many B ends, legs used twice. */
export function cableIssues(lib: Library, design: RackDesign, run: CableRun): string[] {
  const media = lib.cableMedia.get(run.mediaId);
  if (!media) return [`Unknown cable ${run.mediaId}`];
  const ends = cableEnds(media);
  const issues: string[] = [];
  const check = (ep: CableEndpoint, want: string, side: string) => {
    const legs = endpointLegs(lib, design, ep.placementId, ep.portRef);
    if (!ep.portRef || !legs) return;
    if (legs.connector.toLowerCase() !== want.toLowerCase()) issues.push(`${side} ${endpointLabel(design, ep)} is ${legs.connector}, cable needs ${want}`);
    if (ep.connector && ep.connector > legs.count) issues.push(`${side} ${endpointLabel(design, ep)}: port has ${legs.count} connector(s)`);
  };
  check(run.from, ends.a, 'A');
  run.to.forEach((ep) => check(ep, ends.b, 'B'));
  if (run.to.length > ends.bLegs) issues.push(`${run.to.length} B ends but cable has ${ends.bLegs} leg(s)`);
  const mine = [run.from, ...run.to];
  const others = design.cables.filter((c) => c.id !== run.id).flatMap((c) => [c.from, ...c.to]);
  for (const ep of mine) {
    if (others.some((o) => sameEnd(o, ep)) || mine.filter((m) => sameEnd(m, ep)).length > 1) {
      issues.push(`${endpointLabel(design, ep)} is already connected`);
    }
  }
  return [...new Set(issues)];
}
