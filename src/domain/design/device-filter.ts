import type { RackDesign } from './types';

/**
 * The design as shown with some devices hidden (Cabling view device filter): hidden placements are left out, and
 * so is every cable run with an end on one of them (a link is shown only when both ends are). Cross-rack marks of
 * hidden devices are left out too. The result is for drawing only; edits always go to the full design.
 */
export function visibleDesign(design: RackDesign, hidden: ReadonlySet<string>): RackDesign {
  if (hidden.size === 0) return design;
  const shown = (id: string) => !hidden.has(id);
  return {
    ...design,
    placements: design.placements.filter((p) => shown(p.id)),
    cables: design.cables.filter((c) => [...c.from, ...c.to].every((e) => shown(e.placementId))),
    crossRack: design.crossRack?.filter((e) => shown(e.placementId)),
  };
}
