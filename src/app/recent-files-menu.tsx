import { useEffect, useRef, useState } from 'react';
import { clearRecent, listRecent, supportsRecentFiles, type RecentFile } from '../io/recent-files';
import { Button } from '../ui/button';

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

/** ▾ next to Open: recently opened / saved local project files; picking one opens it. */
export function RecentFilesMenu({ onOpen }: { onOpen(handle: FileSystemFileHandle): void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RecentFile[]>([]);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    void listRecent().then(setItems);
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  const supported = supportsRecentFiles();
  return (
    <span ref={ref} className="dropdown">
      <Button className="btn-caret" aria-label="Recent files" aria-expanded={open}
        title={supported ? 'Open a recent local file' : 'Recent files need a Chromium browser (File System Access)'}
        disabled={!supported} onClick={() => setOpen(!open)}>▾</Button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <div className="dropdown-title">Recent files</div>
          {items.length === 0 && <div className="dropdown-empty">No recent files yet — Open or Save As a project file.</div>}
          {items.map((f) => (
            <button key={`${f.name}-${f.usedAt}`} type="button" role="menuitem" className="dropdown-item"
              onClick={() => { setOpen(false); onOpen(f.handle); }}>
              <span>{f.name}</span>
              <small>{when(f.usedAt)}</small>
            </button>
          ))}
          {items.length > 0 && (
            <button type="button" className="dropdown-item muted" onClick={() => { void clearRecent().then(() => setItems([])); }}>Clear list</button>
          )}
        </div>
      )}
    </span>
  );
}
