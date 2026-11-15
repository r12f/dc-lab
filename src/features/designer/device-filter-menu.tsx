import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { traitsOf } from '../../domain/device/categories';
import { CABLE_TYPES } from '../../domain/optics/cable-types';
import { cableTreePlacement } from '../../domain/optics/grouping';
import { runShown, type ViewFilter } from '../../domain/design/device-filter';
import { CheckMenu } from '../../ui/check-menu';

interface FilterProps {
  lib: Library;
  design: RackDesign;
  filter: ViewFilter;
  onChange(f: ViewFilter): void;
}

/** "Devices n/m": which placed devices are shown (fillers left out); links of hidden devices are not drawn. */
export function DeviceFilterMenu({ lib, design, filter, onChange }: FilterProps) {
  const devices = design.placements.filter((p) => {
    const d = lib.devices.get(p.deviceId);
    return d && !traitsOf(d.category).filler;
  });
  const shownLinks = design.cables.filter((c) => runShown(lib, c, filter)).length;
  return (
    <CheckMenu label="Devices" title="Choose the devices drawn; links are drawn when both their devices are shown"
      items={devices.map((p) => ({ id: p.id, label: p.label, sub: lib.devices.get(p.deviceId)?.name }))}
      hidden={filter.hiddenDevices} onChange={(h) => onChange({ ...filter, hiddenDevices: h })}
      info={`${shownLinks}/${design.cables.length} links`} />
  );
}

/**
 * "Cables n/m": which cable items are drawn — each item in Optics / Cables (a Y-cable, a shuffle, a DAC…) is its own
 * entry, grouped under its type. Only items used in the design are listed; modules (transceivers) are not cables.
 */
export function CableTypeMenu({ lib, design, filter, onChange }: FilterProps) {
  const count = new Map<string, number>();
  for (const c of design.cables) count.set(c.mediaId, (count.get(c.mediaId) ?? 0) + c.quantity);
  const items = [...count.keys()].map((id) => {
    const m = lib.cableMedia.get(id);
    return { id, m, place: m ? cableTreePlacement(m) : undefined };
  }).sort((a, b) => (a.place?.pathOrder[0] ?? 99) - (b.place?.pathOrder[0] ?? 99)
    || String(a.place?.order ?? a.id).localeCompare(String(b.place?.order ?? b.id)));
  return (
    <CheckMenu label="Cables" title="Choose the cables drawn"
      items={items.map(({ id, m }) => ({
        id, label: m?.name ?? id,
        group: m ? CABLE_TYPES[m.type] : 'Unknown',
        sub: `${count.get(id)}`,
      }))}
      hidden={filter.hiddenCables} onChange={(h) => onChange({ ...filter, hiddenCables: h })} />
  );
}

const FACE_LABEL: Record<PortFace, string> = { front: 'Front', rear: 'Rear' };

/** "Views n/2": front and / or rear shown (at least one). */
export function FaceMenu({ faces, onChange }: { faces: readonly PortFace[]; onChange(faces: PortFace[]): void }) {
  const all: PortFace[] = ['front', 'rear'];
  return (
    <CheckMenu label="Views" title="Show the front view, the rear view, or both" noBulk compact minChecked={1}
      items={all.map((f) => ({ id: f, label: FACE_LABEL[f] }))}
      hidden={new Set(all.filter((f) => !faces.includes(f)))}
      onChange={(h) => onChange(all.filter((f) => !h.has(f)))} />
  );
}
