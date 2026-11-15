import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { traitsOf } from '../../domain/device/categories';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';

interface Props {
  lib: Library;
  design: RackDesign;
  /** Placement ids hidden from the cabling view. */
  hidden: ReadonlySet<string>;
  onChange(hidden: Set<string>): void;
}

/** Cabling view device filter: unchecked devices and every link touching them are not drawn. */
export function DeviceFilterPanel({ lib, design, hidden, onChange }: Props) {
  // Fillers (blanking, stiffener, reserved, brush) have no ports: nothing to filter.
  const devices = design.placements.filter((p) => {
    const d = lib.devices.get(p.deviceId);
    return d && !traitsOf(d.category).filler;
  });
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const shownLinks = design.cables.filter((c) => [...c.from, ...c.to].every((e) => !hidden.has(e.placementId))).length;
  return (
    <Section title={`Devices shown (${devices.filter((p) => !hidden.has(p.id)).length}/${devices.length})`}
      actions={
        <span className="row-actions">
          <Button onClick={() => onChange(new Set())} title="Show every device">All</Button>
          <Button onClick={() => onChange(new Set(devices.map((p) => p.id)))} title="Hide every device">None</Button>
        </span>
      }>
      <p className="muted">{`${shownLinks} of ${design.cables.length} links drawn (a link is drawn when both its devices are checked).`}</p>
      <div className="device-filter">
        {devices.map((p) => (
          <label key={p.id} className="check" title={lib.devices.get(p.deviceId)?.name}>
            <input type="checkbox" checked={!hidden.has(p.id)} onChange={() => toggle(p.id)} />
            <span>{p.label}</span>
            <span className="muted">{lib.devices.get(p.deviceId)?.name}</span>
          </label>
        ))}
      </div>
    </Section>
  );
}
