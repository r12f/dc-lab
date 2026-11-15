import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { exportSvg } from '../io/export-svg';
import { Button } from './button';
import { useMaximize } from '../state/maximize';

interface Props {
  title: string;
  exportName: string;
  toolbar?: ReactNode;
  /** View controls placed right before the zoom buttons (e.g. a filter dropdown). */
  viewControls?: ReactNode;
  /**
   * When this changes (and on first show), the zoom fits the drawing's width to the pane (never above 100 %), so
   * a larger drawing shows a smaller zoom level instead of a silently smaller drawing.
   */
  fitKey?: string;
  children(svgRef: RefObject<SVGSVGElement | null>): ReactNode;
}

/** Zoom steps of the canvas (1 = 100 %). */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

/** Zoom that fits a drawing of `drawingW` px into `paneW` px: at most 100 %, at least the smallest step. */
export function fitZoom(paneW: number, drawingW: number): number {
  if (!(drawingW > 0) || !(paneW > 0)) return 1;
  return Math.max(ZOOM_STEPS[0], Math.min(1, Math.floor((paneW / drawingW) * 100) / 100));
}

/** Next zoom step in a direction (+1 in, -1 out), clamped to the ends. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > zoom + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom - 1e-6) ?? ZOOM_STEPS[0];
}

/**
 * Canvas area with a toolbar: zoom (− / % / +, Ctrl+wheel), "Export SVG" and maximize. Zoom uses CSS `zoom` on
 * the drawing, so the scroll area grows with it and pointer mapping (getScreenCTM) stays correct.
 */
export function CanvasFrame({ title, exportName, toolbar, viewControls, fitKey, children }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const maximized = useMaximize((s) => s.maximized);
  const setMaximized = useMaximize((s) => s.setMaximized);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Ctrl+wheel zooms the canvas instead of the page: needs a non-passive native listener (React's onWheel is
  // passive, so preventDefault would not stop the browser zoom).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wheel = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => stepZoom(z, e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    if (fitKey === undefined) return;
    const el = scrollRef.current;
    const w = Number(svgRef.current?.getAttribute('width'));
    if (!el || !w) return;
    setZoom(fitZoom(el.clientWidth - 32, w));
  }, [fitKey]);
  return (
    <div className="canvas-frame">
      <div className="canvas-toolbar">
        <h2>{title}</h2>
        <div className="spacer" />
        {toolbar}
        <Button onClick={() => svgRef.current && exportSvg(svgRef.current, exportName)}>Export SVG</Button>
        {viewControls}
        <Button aria-label="Zoom out" title="Zoom out (Ctrl+wheel)" disabled={zoom <= ZOOM_STEPS[0]} onClick={() => setZoom((z) => stepZoom(z, -1))}>−</Button>
        <Button aria-label="Reset zoom" title="Reset zoom to 100 %" className="zoom-level" onClick={() => setZoom(1)}>{`${Math.round(zoom * 100)}%`}</Button>
        <Button aria-label="Zoom in" title="Zoom in (Ctrl+wheel)" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => setZoom((z) => stepZoom(z, 1))}>+</Button>
        <Button aria-label={maximized ? 'Restore panels' : 'Maximize'} title={maximized ? 'Restore panels (Esc)' : 'Maximize: hide the module tabs and side panels'}
          onClick={() => setMaximized(!maximized)}>{maximized ? '⤡' : '⤢'}</Button>
      </div>
      <div className="canvas-scroll" ref={scrollRef}>
        <div className="canvas-zoom" style={{ zoom }}>{children(svgRef)}</div>
      </div>
    </div>
  );
}

export function EmptyCanvas({ text }: { text: string }) {
  const maximized = useMaximize((s) => s.maximized);
  const setMaximized = useMaximize((s) => s.setMaximized);
  // Never strand the user in a maximized empty canvas.
  return (
    <div className="empty-canvas">
      {text}
      {maximized && <Button aria-label="Restore panels" title="Restore panels (Esc)" onClick={() => setMaximized(false)}>⤡</Button>}
    </div>
  );
}
