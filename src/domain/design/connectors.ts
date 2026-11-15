import type { Library } from '../library/library';
import { portConnectors } from '../ports/optic-match';
import { connectorsMate, genderFits } from '../optics/connectors';
import { resolvePlacedPort } from './optics';
import type { CableEndpoint, CableRun, RackDesign } from './types';

/** Connector legs of a port of a placed device: e.g. 2 x MPO-12 for a 2xDR4 module. */
export function endpointLegs(lib: Library, design: RackDesign, placementId: string, portRef: string) {
  const p = design.placements.find((x) => x.id === placementId);
  const d = p && lib.devices.get(p.deviceId);
  if (!p || !d || !portRef) return undefined;
  const r = resolvePlacedPort(lib, d, p, portRef);
  return r ? portConnectors(r.group, r.optic) : undefined;
}


const endKey = (e: CableEndpoint) => `${e.placementId}|${e.portRef}|${e.connector ?? ''}`;
/** How many cable ends sit on each connector (placement + port + leg); > 1 = used twice. Cached per design. */
const usesCache = new WeakMap<RackDesign, Map<string, number>>();
function connectorUses(design: RackDesign): Map<string, number> {
  let m = usesCache.get(design);
  if (!m) {
    m = new Map();
    for (const c of design.cables) for (const e of [...c.from, ...c.to]) if (e.portRef && e.connector) m.set(endKey(e), (m.get(endKey(e)) ?? 0) + 1);
    usesCache.set(design, m);
  }
  return m;
}

/** Human-readable endpoint, e.g. "SW1 osfp/3.2" (leg 2 of port osfp/3). */
export function endpointLabel(design: RackDesign, ep: CableEndpoint): string {
  const p = design.placements.find((x) => x.id === ep.placementId);
  const port = ep.portRef ? ` ${ep.portRef}${ep.connector ? `.${ep.connector}` : ''}` : '';
  return `${p?.label ?? '?'}${port}`;
}

/** Problems with a run: connector mismatch, too many endpoints, pinned-to-pinned, legs used twice. */
export function cableIssues(lib: Library, design: RackDesign, run: CableRun): string[] {
  const media = lib.cableMedia.get(run.mediaId);
  if (!media) return [`Unknown cable ${run.mediaId}`];
  const issues: string[] = [];
  const check = (ep: CableEndpoint, side: 'A' | 'B') => {
    const end = side === 'A' ? media.ends.a : media.ends.b;
    const legs = endpointLegs(lib, design, ep.placementId, ep.portRef);
    if (!ep.portRef || !legs) return;
    const label = `${side} ${endpointLabel(design, ep)}`;
    if (!connectorsMate(legs.connector, end.connector)) issues.push(`${label} is ${legs.connector}, cable end is ${end.connector}`);
    if (ep.connector && ep.connector > legs.count) issues.push(`${label}: port has ${legs.count} connector(s)`);
    if (!genderFits(end.gender, legs.cableGender)) {
      issues.push(`${label}: ${end.gender} cable end, port takes ${legs.cableGender} ${legs.connector}`);
    }
  };
  run.from.forEach((ep) => check(ep, 'A'));
  run.to.forEach((ep) => check(ep, 'B'));
  if (run.from.length > media.ends.a.count) issues.push(`${run.from.length} A ends but cable has ${media.ends.a.count} A connector(s)`);
  if (run.to.length > media.ends.b.count) issues.push(`${run.to.length} B ends but cable has ${media.ends.b.count} B connector(s)`);
  const uses = connectorUses(design);
  for (const ep of [...run.from, ...run.to]) {
    if (ep.portRef && ep.connector && (uses.get(endKey(ep)) ?? 0) > 1) issues.push(`${endpointLabel(design, ep)} is already connected`);
  }
  return [...new Set(issues)];
}
