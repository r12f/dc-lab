import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { shownPartition, type DiagramOptions } from '../../domain/topo/diagram';
import type { VGroup } from '../../domain/topo/virtual';

/**
 * Toolbar dropdown choosing what the group boxes show: per group, which partition is drawn as sets (or none),
 * and whether port pools are drawn.
 */
export function DiagramMenu({ groups, options, onChange }: { groups: VGroup[]; options: DiagramOptions; onChange(o: DiagramOptions): void }) {
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
  const withSets = groups.filter((g) => g.partitions.length);
  return (
    <div className="dropdown" ref={root}>
      <Button aria-haspopup="true" aria-expanded={open} title="What the group boxes show: partition sets and port pools"
        onClick={() => setOpen(!open)}>Groups ▾</Button>
      {open && (
        <div className="dropdown-menu topo-menu" role="menu">
          <label className="check">
            <input type="checkbox" checked={options.ports} onChange={(e) => onChange({ ...options, ports: e.target.checked })} />
            <span>Port pools</span>
          </label>
          {withSets.length > 0 && <div className="check-group">Sets by partition</div>}
          {withSets.map((g) => (
            <label key={g.name} className="topo-menu-row">
              <span>{g.name}</span>
              <select value={shownPartition(g, options)} aria-label={`Partition shown for ${g.name}`}
                onChange={(e) => onChange({ ...options, partition: { ...options.partition, [g.name]: e.target.value } })}>
                {g.partitions.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
                <option value="">none</option>
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
