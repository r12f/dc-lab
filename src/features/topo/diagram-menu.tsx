import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { nestingChoices, shownNesting, type DiagramOptions } from '../../domain/topo/diagram';
import type { VirtualTopo } from '../../domain/topo/virtual';

/**
 * Toolbar dropdown choosing what the group boxes show: per group, the partition keys it is split by (outer › inner,
 * or none), whether port grids are drawn, and resetting moved / collapsed boxes.
 */
export function DiagramMenu({ topo, options, onChange, onResetView }: {
  topo: VirtualTopo; options: DiagramOptions; onChange(o: DiagramOptions): void;
  /** Put moved boxes back and expand collapsed ones; absent when nothing is moved or collapsed. */
  onResetView?: () => void;
}) {
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
  const withSets = topo.groups.filter((g) => g.partitions.length);
  return (
    <div className="dropdown" ref={root}>
      <Button aria-haspopup="true" aria-expanded={open} title="How each group box is split (partition keys, outer › inner) and whether port grids are drawn"
        onClick={() => setOpen(!open)}>Groups ▾</Button>
      {open && (
        <div className="dropdown-menu topo-menu" role="menu">
          <label className="check">
            <input type="checkbox" checked={options.ports} onChange={(e) => onChange({ ...options, ports: e.target.checked })} />
            <span>Port grids</span>
          </label>
          {onResetView && <Button onClick={() => { onResetView(); setOpen(false); }}>Reset box positions</Button>}
          {withSets.length > 0 && <div className="check-group">Split by partition (outer › inner)</div>}
          {withSets.map((g) => (
            <label key={g.name} className="topo-menu-row">
              <span>{g.name}</span>
              <select value={shownNesting(g, options, topo)} aria-label={`Partition shown for ${g.name}`}
                onChange={(e) => onChange({ ...options, partition: { ...options.partition, [g.name]: e.target.value } })}>
                {nestingChoices(g).map((k) => <option key={k} value={k}>{k.replace('>', ' › ')}</option>)}
                <option value="">none</option>
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
