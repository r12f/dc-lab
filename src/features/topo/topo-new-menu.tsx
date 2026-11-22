import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';

/** Toolbar "+ New" dropdown: adds a device set group (a block) or a link spec to the topology file. */
export function TopoNewMenu({ onAdd, canLink, disabled }: {
  onAdd(kind: 'group' | 'link'): void;
  /** False while the file has no group to link. */
  canLink: boolean;
  /** Why nothing can be added (the file does not parse), or undefined. */
  disabled?: string;
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
  const pick = (kind: 'group' | 'link') => { onAdd(kind); setOpen(false); };
  return (
    <div className="dropdown" ref={root}>
      <Button variant="primary" aria-haspopup="true" aria-expanded={open} disabled={!!disabled} title={disabled ?? 'Add a device set group or a link'}
        onClick={() => setOpen(!open)}>+ New</Button>
      {open && (
        <div className="dropdown-menu compact topo-new-menu" role="menu">
          <div className="menu-item" role="menuitem" onClick={() => pick('group')}>
            Device set group<small>A block: role, count, port pools</small>
          </div>
          <div className={`menu-item ${canLink ? '' : 'disabled'}`} role="menuitem" aria-disabled={!canLink}
            title={canLink ? undefined : 'Add a device set group first'} onClick={() => canLink && pick('link')}>
            Link<small>Between port pools of two groups</small>
          </div>
        </div>
      )}
    </div>
  );
}
