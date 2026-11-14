import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Dropdown that floats over the sidebar list (see `.menu`). Closes on a click outside, on Esc,
 * or when the pointer leaves it.
 */
export function FloatingMenu({ onClose, children }: { onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      // Ignore the click that opened it (the "+ New" button toggles the menu itself).
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('.sidebar-head')) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);
  return <div ref={ref} className="menu" role="menu" onMouseLeave={onClose}>{children}</div>;
}
