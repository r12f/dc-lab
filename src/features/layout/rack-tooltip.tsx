/** Floating tooltip near the pointer (HTML, outside the SVG so it is never exported). */
export function RackTooltip({ lines, x, y }: { lines: string[]; x: number; y: number }) {
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <strong>{lines[0]}</strong>
      {lines.slice(1).map((l, i) => <div key={i} className={l.startsWith('⚠') ? 'error' : l.startsWith('  ') ? 'muted' : ''}>{l}</div>)}
    </div>
  );
}
