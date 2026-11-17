import { useEffect, useState } from 'react';

/** Gap (px) between the pointer and the tooltip, so the racks next to the pointer stay visible and clickable. */
const GAP = 48;
/** Hover time (ms) before the tooltip shows: moving across racks to click one never flashes it. */
const DELAY = 600;

/**
 * Floating tooltip near the pointer (HTML, outside the SVG so it is never exported). Kept well clear of the pointer
 * (below-right, flipped to the other side near the window edge), shown only after a short hover, never takes clicks.
 */
export function RackTooltip({ lines, x, y }: { lines: string[]; x: number; y: number }) {
  const [shown, setShown] = useState(false);
  const key = lines[0];
  useEffect(() => {
    setShown(false);
    const t = window.setTimeout(() => setShown(true), DELAY);
    return () => window.clearTimeout(t);
  }, [key]);
  if (!shown) return null;
  const flipX = x > window.innerWidth * 0.6;
  const flipY = y > window.innerHeight * 0.6;
  const style = {
    left: flipX ? undefined : x + GAP,
    right: flipX ? window.innerWidth - x + GAP : undefined,
    top: flipY ? undefined : y + GAP,
    bottom: flipY ? window.innerHeight - y + GAP : undefined,
  };
  return (
    <div className="tooltip" style={style}>
      <strong>{lines[0]}</strong>
      {lines.slice(1).map((l, i) => <div key={i} className={l.startsWith('⚠') ? 'error' : l.startsWith('  ') ? 'muted' : ''}>{l}</div>)}
    </div>
  );
}
