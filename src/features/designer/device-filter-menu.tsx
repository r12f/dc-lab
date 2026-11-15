import { useEffect, useRef, useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { traitsOf } from '../../domain/device/categories';
import { Button } from '../../ui/button';

interface Props {
  lib: Library;
  design: RackDesign;
  /** Placement ids hidden from the cabling view. */
  hidden: ReadonlySet<string>;
  onChange(hidden: Set<string>): void;
}

/**
 * Cabling view device filter: a toolbar button ("Devices n/m") that drops down a checkbox list. Unchecked devices
 * and every link touching them are not drawn. Closes on outside click or Escape.
 */
export function DeviceFilterMenu({ lib, design, hidden, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open]);

  // Fillers (blanking, stiffener, reserved, brush) have no ports: nothing to filter.
  const devices = design.placements.filter((p) => {
    const d = lib.devices.get(p.deviceId);
    return d && !traitsOf(d.category).filler;
  });
  const shown = devices.filter((p) => !hidden.has(p.id)).length;
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const shownLinks = design.cables.filter((c) => [...c.from, ...c.to].every((e) => !hidden.has(e.placementId))).length;

  return (
    <div className="dropdown" ref={root}>
      <Button variant={hidden.size ? 'primary' : 'default'} aria-haspopup="true" aria-expanded={open}
        title="Choose the devices drawn; links are drawn when both their devices are shown" onClick={() => setOpen(!open)}>
        {`Devices ${shown}/${devices.length} ▾`}
      </Button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <div className="device-filter-head">
            <span className="muted">{`${shownLinks}/${design.cables.length} links`}</span>
            <span className="row-actions">
              <Button onClick={() => onChange(new Set())} title="Show every device">All</Button>
              <Button onClick={() => onChange(new Set(devices.map((p) => p.id)))} title="Hide every device">None</Button>
            </span>
          </div>
          <div className="device-filter-list">
            {devices.map((p) => (
              <label key={p.id} className="check" title={lib.devices.get(p.deviceId)?.name}>
                <input type="checkbox" checked={!hidden.has(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.label}</span>
                <span className="muted">{lib.devices.get(p.deviceId)?.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
