import type { ReactNode } from 'react';
import { DEFAULT_INSPECTOR_WIDTHS, DEFAULT_PANES, inspectorWidthFor, usePreferences } from '../state/preferences';
import { Splitter } from './splitter';
import { useMaximize } from '../state/maximize';

interface Props {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  /** Module id: lets a module keep its own inspector width (Rack Designer defaults wider for its BOM). */
  module?: string;
}

const RAIL = 22;

/** Three-pane module layout: sidebar | canvas | inspector, with resizable, collapsible side panes. */
export function ModuleLayout({ sidebar, canvas, inspector, module }: Props) {
  const panes = usePreferences((s) => s.panes);
  const maximized = useMaximize((s) => s.maximized);
  const setPaneWidth = usePreferences((s) => s.setPaneWidth);
  const widths = usePreferences((s) => s.inspectorWidths);
  const setInspectorWidth = usePreferences((s) => s.setInspectorWidth);
  const inspectorW = inspectorWidthFor(module, panes, widths);
  const own = !!module && (module in widths || module in DEFAULT_INSPECTOR_WIDTHS);
  const resizeInspector = (px: number) => (own ? setInspectorWidth(module!, px) : setPaneWidth('inspector', px));
  const resetInspector = () => (own ? setInspectorWidth(module!, undefined) : setPaneWidth('inspector', DEFAULT_PANES.inspector));
  // The canvas keeps at least 240px; side panes shrink to fit narrow windows instead of overflowing.
  const collapsed = usePreferences((s) => s.collapsed);
  const togglePane = usePreferences((s) => s.togglePane);
  // Collapsed panes become a thin rail (RAIL px) holding the expand button.
  const sideCol = collapsed.sidebar ? `${RAIL}px` : `minmax(0, ${panes.sidebar}px)`;
  const inspCol = collapsed.inspector ? `${RAIL}px` : `minmax(0, ${inspectorW}px)`;
  const columns = `${sideCol} 0 minmax(240px, 1fr)${inspector ? ` 0 ${inspCol}` : ''}`;
  // Maximized: only the canvas (side panes stay mounted but hidden, so their state survives).
  if (maximized) {
    return (
      <div className="module" style={{ gridTemplateColumns: '1fr' }}>
        <aside className="sidebar" hidden>{sidebar}</aside>
        <main className="canvas-pane">{canvas}</main>
        {inspector && <aside className="inspector" hidden>{inspector}</aside>}
      </div>
    );
  }
  const showSide = !collapsed.sidebar;
  const showInsp = !!inspector && !collapsed.inspector;
  return (
    <div className="module" style={{ gridTemplateColumns: columns }}>
      {/* Collapsed: a thin rail with an expand button; the pane stays mounted (hidden) so its state survives. */}
      {showSide ? (
        <div className="pane-wrap">
          <aside className="sidebar">{sidebar}</aside>
          <button type="button" className="pane-toggle pane-toggle-left" title="Collapse sidebar (Ctrl+[)" aria-label="Collapse sidebar"
            onClick={() => togglePane('sidebar')}>«</button>
        </div>
      ) : (
        <>
          <aside className="sidebar" hidden>{sidebar}</aside>
          <button type="button" className="pane-rail pane-rail-left" title="Expand sidebar (Ctrl+[)" aria-label="Expand sidebar"
            onClick={() => togglePane('sidebar')}>»</button>
        </>
      )}
      {showSide ? (
        <Splitter label="Sidebar width" width={panes.sidebar} direction={1}
          onResize={(px) => setPaneWidth('sidebar', px)} onReset={() => setPaneWidth('sidebar', DEFAULT_PANES.sidebar)} />
      ) : <span />}
      <main className="canvas-pane">{canvas}</main>
      {inspector && (showInsp ? (
        <>
          <Splitter label="Inspector width" width={inspectorW} direction={-1} onResize={resizeInspector} onReset={resetInspector} />
          <div className="pane-wrap">
            <aside className="inspector">{inspector}</aside>
            <button type="button" className="pane-toggle pane-toggle-right" title="Collapse inspector (Ctrl+])" aria-label="Collapse inspector"
              onClick={() => togglePane('inspector')}>»</button>
          </div>
        </>
      ) : (
        <>
          <span />
          <aside className="inspector" hidden>{inspector}</aside>
          <button type="button" className="pane-rail pane-rail-right" title="Expand inspector (Ctrl+])" aria-label="Expand inspector"
            onClick={() => togglePane('inspector')}>«</button>
        </>
      ))}
    </div>
  );
}
