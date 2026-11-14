import { useRef, type ReactNode, type RefObject } from 'react';
import { exportSvg } from '../io/export-svg';
import { Button } from './button';

interface Props {
  title: string;
  exportName: string;
  toolbar?: ReactNode;
  children(svgRef: RefObject<SVGSVGElement | null>): ReactNode;
}

/** Canvas area with a toolbar and an "Export SVG" action for the contained <svg>. */
export function CanvasFrame({ title, exportName, toolbar, children }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  return (
    <div className="canvas-frame">
      <div className="canvas-toolbar">
        <h2>{title}</h2>
        <div className="spacer" />
        {toolbar}
        <Button onClick={() => svgRef.current && exportSvg(svgRef.current, exportName)}>Export SVG</Button>
      </div>
      <div className="canvas-scroll">{children(svgRef)}</div>
    </div>
  );
}

export function EmptyCanvas({ text }: { text: string }) {
  return <div className="empty-canvas">{text}</div>;
}
