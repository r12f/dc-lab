import { useRef, type PointerEvent } from 'react';

interface Props {
  /** Current size of the pane being resized (px): width, or height for a horizontal splitter. */
  width: number;
  /** +1 when dragging right/down grows the pane, -1 when it shrinks it. */
  direction: 1 | -1;
  onResize(px: number): void;
  onReset(): void;
  label: string;
  /** `vertical` (default) sits between columns; `horizontal` between stacked panes. */
  orientation?: 'vertical' | 'horizontal';
}

/** Drag handle between panes. Double-click resets to the default size. */
export function Splitter({ width, direction, onResize, onReset, label, orientation = 'vertical' }: Props) {
  const start = useRef<{ p: number; w: number } | undefined>(undefined);
  const horizontal = orientation === 'horizontal';
  const pos = (e: PointerEvent<HTMLDivElement>) => (horizontal ? e.clientY : e.clientX);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { p: pos(e), w: width };
    document.body.classList.add(horizontal ? 'resizing-rows' : 'resizing');
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) onResize(start.current.w + direction * (pos(e) - start.current.p));
  };
  const up = () => {
    start.current = undefined;
    document.body.classList.remove('resizing', 'resizing-rows');
  };
  return (
    <div className={horizontal ? 'splitter splitter-h' : 'splitter'} role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'} aria-label={label}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onReset} />
  );
}
