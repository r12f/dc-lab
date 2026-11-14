import { useRef, type ReactNode, type RefObject } from 'react';
import { exportSvg } from '../io/export-svg';
import { Button } from './button';
import { useMaximize } from '../state/maximize';

interface Props {
  title: string;
  exportName: string;
  toolbar?: ReactNode;
  children(svgRef: RefObject<SVGSVGElement | null>): ReactNode;
}

/** Canvas area with a toolbar and an "Export SVG" action for the contained <svg>. */
export function CanvasFrame({ title, exportName, toolbar, children }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const maximized = useMaximize((s) => s.maximized);
  const setMaximized = useMaximize((s) => s.setMaximized);
  return (
    <div className="canvas-frame">
      <div className="canvas-toolbar">
        <h2>{title}</h2>
        <div className="spacer" />
        {toolbar}
        <Button onClick={() => svgRef.current && exportSvg(svgRef.current, exportName)}>Export SVG</Button>
        <Button title={maximized ? 'Restore panels (Esc)' : 'Maximize: hide the module tabs and side panels'}
          onClick={() => setMaximized(!maximized)}>{maximized ? '⤡ Restore' : '⤢ Max'}</Button>
      </div>
      <div className="canvas-scroll">{children(svgRef)}</div>
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
      {maximized && <Button onClick={() => setMaximized(false)}>⤡ Restore</Button>}
    </div>
  );
}
