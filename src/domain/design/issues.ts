import type { Library } from '../library/library';
import type { RackDesign } from './types';
import { placementProblem } from './placement';
import { cableIssues } from './connectors';
import { computeRackMetrics } from './metrics';
import { memoByDesign } from './memo';

/** Every problem of a design, attached to what it is about so the elevation can mark it. */
export interface DesignIssues {
  /** placementId -> problems (overlap, does not fit, wrong unit system, side slot…). */
  placements: Map<string, string[]>;
  /** cable run id -> problems (connector mismatch, too many ends, pinned-to-pinned…). */
  cables: Map<string, string[]>;
  /** Rack-wide problems (power over rating / supply, payload over load). */
  rack: string[];
  count: number;
}

/** Every problem of the design; cached per (library, design) snapshot. */
export const designIssues = memoByDesign(computeDesignIssues);

function computeDesignIssues(lib: Library, design: RackDesign): DesignIssues {
  const placements = new Map<string, string[]>();
  for (const p of design.placements) {
    const d = lib.devices.get(p.deviceId);
    const problem = d ? placementProblem(lib, design, d, p.mount, p.id) : `Unknown device "${p.deviceId}"`;
    if (problem) placements.set(p.id, [problem]);
  }
  const cables = new Map<string, string[]>();
  for (const c of design.cables) {
    const list = cableIssues(lib, design, c);
    if (list.length) cables.set(c.id, list);
  }
  // Rack-wide: metrics warnings that are not about a single placement.
  const labels = design.placements.map((p) => `${p.label}:`);
  const rack = computeRackMetrics(lib, design).warnings.filter((w) => !labels.some((l) => w.startsWith(l)));
  const count = [...placements.values(), ...cables.values()].reduce((n, l) => n + l.length, 0) + rack.length;
  return { placements, cables, rack, count };
}
