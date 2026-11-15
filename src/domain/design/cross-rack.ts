import type { CableEndpoint, RackDesign } from './types';
import { endpointKey, usedConnectors } from './cable-assign';

/** endpointKey set of the design's cross-rack connectors. */
export function crossRackKeys(design: RackDesign): Set<string> {
  return new Set((design.crossRack ?? []).map(endpointKey));
}

export interface CrossRackChange {
  crossRack: CableEndpoint[];
  error?: string;
}

/**
 * Toggles the cross-rack mark on the selected connectors: when every selected connector is already marked, the
 * marks are removed; otherwise all of them become marked. A connector with an in-rack cable cannot be marked.
 */
export function toggleCrossRack(design: RackDesign, selection: CableEndpoint[]): CrossRackChange {
  const current = design.crossRack ?? [];
  if (!selection.length) return { crossRack: current, error: 'Select connectors first' };
  const marked = crossRackKeys(design);
  const keys = selection.map(endpointKey);
  if (keys.every((k) => marked.has(k))) return { crossRack: current.filter((e) => !keys.includes(endpointKey(e))) };
  const used = usedConnectors(design);
  const cabled = selection.find((e) => used.has(endpointKey(e)));
  if (cabled) return { crossRack: current, error: `${cabled.portRef}${cabled.connector ? `.${cabled.connector}` : ''} has an in-rack cable` };
  const add = selection.filter((e) => !marked.has(endpointKey(e))).map((e) => ({ ...e }));
  return { crossRack: [...current, ...add] };
}
