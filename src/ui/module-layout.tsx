import type { ReactNode } from 'react';
import { DEFAULT_INSPECTOR_WIDTHS, DEFAULT_PANES, inspectorWidthFor, usePreferences } from '../state/preferences';
import { Splitter } from './splitter';

interface Props {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  /** Module id: lets a module keep its own inspector width (Rack Designer defaults wider for its BOM). */
  module?: string;
}

/** Three-pane module layout: sidebar | canvas | inspector, with resizable side panes. */
export function ModuleLayout({ sidebar, canvas, inspector, module }: Props) {
  const panes = usePreferences((s) => s.panes);
  const setPaneWidth = usePreferences((s) => s.setPaneWidth);
  const widths = usePreferences((s) => s.inspectorWidths);
  const setInspectorWidth = usePreferences((s) => s.setInspectorWidth);
  const inspectorW = inspectorWidthFor(module, panes, widths);
  const own = !!module && (module in widths || module in DEFAULT_INSPECTOR_WIDTHS);
  const resizeInspector = (px: number) => (own ? setInspectorWidth(module!, px) : setPaneWidth('inspector', px));
  const resetInspector = () => (own ? setInspectorWidth(module!, undefined) : setPaneWidth('inspector', DEFAULT_PANES.inspector));
  // The canvas keeps at least 240px; side panes shrink to fit narrow windows instead of overflowing.
  const columns = `minmax(0, ${panes.sidebar}px) 0 minmax(240px, 1fr)${inspector ? ` 0 minmax(0, ${inspectorW}px)` : ''}`;
  return (
    <div className="module" style={{ gridTemplateColumns: columns }}>
      <aside className="sidebar">{sidebar}</aside>
      <Splitter label="Sidebar width" width={panes.sidebar} direction={1}
        onResize={(px) => setPaneWidth('sidebar', px)} onReset={() => setPaneWidth('sidebar', DEFAULT_PANES.sidebar)} />
      <main className="canvas-pane">{canvas}</main>
      {inspector && (
        <>
          <Splitter label="Inspector width" width={inspectorW} direction={-1} onResize={resizeInspector} onReset={resetInspector} />
          <aside className="inspector">{inspector}</aside>
        </>
      )}
    </div>
  );
}
