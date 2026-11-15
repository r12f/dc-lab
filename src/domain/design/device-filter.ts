import type { Library } from '../library/library';
import type { CableType } from '../optics/types';
import type { CableRun, RackDesign } from './types';

/** Device and cable-type filters of the Rack Designer canvas (session only, per design). */
export interface ViewFilter {
  /** Placement ids not shown. */
  hiddenDevices: ReadonlySet<string>;
  /** Cable items (media ids: a Y-cable, a shuffle, a DAC…) not shown. */
  hiddenCables: ReadonlySet<string>;
}

/** Top-level type of a run's cable; undefined for an unknown cable. */
export function runCableType(lib: Library, run: CableRun): CableType | undefined {
  return lib.cableMedia.get(run.mediaId)?.type;
}

/** A run is shown when every device it touches is shown and its cable item is shown. */
export function runShown(_lib: Library, run: CableRun, f: ViewFilter): boolean {
  if ([...run.from, ...run.to].some((e) => f.hiddenDevices.has(e.placementId))) return false;
  return !f.hiddenCables.has(run.mediaId);
}

const noFilter = (f: ViewFilter) => f.hiddenDevices.size === 0 && f.hiddenCables.size === 0;

/**
 * Elevation filter: every device kept (hidden ones are drawn faded), only the shown runs. The same object when
 * nothing is filtered, so cached drawing data stays valid.
 */
export function visibleCables(lib: Library, design: RackDesign, f: ViewFilter): RackDesign {
  if (noFilter(f)) return design;
  return { ...design, cables: design.cables.filter((c) => runShown(lib, c, f)) };
}

/**
 * Cabling view filter: hidden devices left out, and every run that touches one or whose cable item is hidden;
 * cross-rack marks of hidden devices left out. Drawing only; edits always go to the full design.
 */
export function visibleDesign(lib: Library, design: RackDesign, f: ViewFilter): RackDesign {
  if (noFilter(f)) return design;
  const shown = (id: string) => !f.hiddenDevices.has(id);
  return {
    ...design,
    placements: design.placements.filter((p) => shown(p.id)),
    cables: design.cables.filter((c) => runShown(lib, c, f)),
    crossRack: design.crossRack?.filter((e) => shown(e.placementId)),
  };
}
