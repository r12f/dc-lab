import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Gap (px) between the anchor (the hovered rack) and the tooltip. */
const GAP = 16;
/** Hover time (ms) before the tooltip shows: moving across racks to click one never flashes it. */
const DELAY = 600;

/**
 * Floating tooltip beside an element (HTML, outside the SVG so it is never exported): to the right of the anchor box
 * when there is room, else to its left, else below / above it — never over the anchor, never taking clicks. Shown
 * after a short hover.
 */
export function RackTooltip({ lines, anchor }: { lines: string[]; anchor: DOMRect }) {
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  const box = useRef<HTMLDivElement>(null);
  const key = lines[0];
  useEffect(() => {
    setShown(false);
    setPos(undefined);
    const t = window.setTimeout(() => setShown(true), DELAY);
    return () => window.clearTimeout(t);
  }, [key]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!shown || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampY = (y: number) => Math.max(8, Math.min(vh - h - 8, y));
    const clampX = (x: number) => Math.max(8, Math.min(vw - w - 8, x));
    const midY = clampY(anchor.top + anchor.height / 2 - h / 2);
    if (anchor.right + GAP + w <= vw - 8) setPos({ left: anchor.right + GAP, top: midY });
    else if (anchor.left - GAP - w >= 8) setPos({ left: anchor.left - GAP - w, top: midY });
    else if (anchor.bottom + GAP + h <= vh - 8) setPos({ left: clampX(anchor.left), top: anchor.bottom + GAP });
    else setPos({ left: clampX(anchor.left), top: Math.max(8, anchor.top - GAP - h) });
  }, [shown, anchor.left, anchor.top, anchor.right, anchor.bottom, anchor.width, anchor.height, lines.length]);
  if (!shown) return null;
  // Portal to <body>: the canvas sits in a CSS-`zoom`ed wrapper, which would scale a fixed tooltip's left/top
  // (at 30 % zoom the tooltip landed far above / left of the rack).
  return createPortal(
    <div ref={box} className="tooltip" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>
      <strong>{lines[0]}</strong>
      {lines.slice(1).map((l, i) => <div key={i} className={l.startsWith('⚠') ? 'error' : l.startsWith('  ') ? 'muted' : ''}>{l}</div>)}
    </div>,
    document.body,
  );
}
