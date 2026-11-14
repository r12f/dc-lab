import { useRef, type PointerEvent } from 'react';

interface Props {
  /** Current width of the pane being resized (px). */
  width: number;
  /** +1 when dragging right grows the pane (left sidebar), -1 when it shrinks it (right inspector). */
  direction: 1 | -1;
  onResize(px: number): void;
  onReset(): void;
  label: string;
}

/** Vertical drag handle between panes. Double-click resets to the default width. */
export function Splitter({ width, direction, onResize, onReset, label }: Props) {
  const start = useRef<{ x: number; w: number } | undefined>(undefined);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    document.body.classList.add('resizing');
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) onResize(start.current.w + direction * (e.clientX - start.current.x));
  };
  const up = () => {
    start.current = undefined;
    document.body.classList.remove('resizing');
  };
  return (
    <div className="splitter" role="separator" aria-orientation="vertical" aria-label={label}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onReset} />
  );
}
