import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';

export interface CheckMenuItem {
  id: string;
  label: string;
  /** Secondary text after the label (muted). */
  sub?: string;
  /** Heading the item is listed under (consecutive items with the same group share one heading). */
  group?: string;
}

interface Props {
  /** Button text before the "n/m" count, e.g. "Devices". */
  label: string;
  items: CheckMenuItem[];
  /** Unchecked item ids. */
  hidden: ReadonlySet<string>;
  onChange(hidden: Set<string>): void;
  title?: string;
  /** Line shown above the list (e.g. "24/300 links"). */
  info?: ReactNode;
  /** At least this many items stay checked (e.g. 1 for views); default 0. */
  minChecked?: number;
  /** Hide the All / None buttons (short lists). */
  noBulk?: boolean;
  /** Narrow menu (a few short items, e.g. Front / Rear). */
  compact?: boolean;
}

/**
 * Toolbar dropdown with a checkbox per item: the button reads "<label> n/m ▾" and is highlighted while some are
 * unchecked. All / None, outside click or Escape closes.
 */
export function CheckMenu({ label, items, hidden, onChange, title, info, minChecked = 0, noBulk, compact }: Props) {
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

  const checked = items.filter((i) => !hidden.has(i.id)).length;
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else if (checked > minChecked) next.add(id);
    onChange(next);
  };
  const anyHidden = items.some((i) => hidden.has(i.id));
  return (
    <div className="dropdown" ref={root}>
      <Button variant={anyHidden ? 'primary' : 'default'} aria-haspopup="true" aria-expanded={open} title={title}
        onClick={() => setOpen(!open)}>
        {`${label} ${checked}/${items.length} ▾`}
      </Button>
      {open && (
        <div className={compact ? 'dropdown-menu compact' : 'dropdown-menu'} role="menu">
          {(info || !noBulk) && (
            <div className="device-filter-head">
              <span className="muted">{info}</span>
              {!noBulk && (
                <span className="row-actions">
                  <Button onClick={() => onChange(new Set())} title="Check all">All</Button>
                  {minChecked === 0 && <Button onClick={() => onChange(new Set(items.map((i) => i.id)))} title="Uncheck all">None</Button>}
                </span>
              )}
            </div>
          )}
          <div className="device-filter-list">
            {items.length === 0 && <span className="muted">Nothing to show.</span>}
            {items.map((i, n) => (
              <Fragment key={i.id}>
              {i.group && i.group !== items[n - 1]?.group && <div className="check-group">{i.group}</div>}
              <label className="check" title={i.sub}>
                <input type="checkbox" checked={!hidden.has(i.id)} onChange={() => toggle(i.id)}
                  disabled={!hidden.has(i.id) && checked <= minChecked} />
                <span>{i.label}</span>
                {i.sub && <span className="muted">{i.sub}</span>}
              </label>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
