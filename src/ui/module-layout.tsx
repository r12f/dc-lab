import type { ReactNode } from 'react';
import { DEFAULT_PANES, usePreferences } from '../state/preferences';
import { Splitter } from './splitter';

interface Props {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
}

/** Three-pane module layout: sidebar | canvas | inspector, with resizable side panes. */
export function ModuleLayout({ sidebar, canvas, inspector }: Props) {
  const panes = usePreferences((s) => s.panes);
  const setPaneWidth = usePreferences((s) => s.setPaneWidth);
  // The canvas keeps at least 240px; side panes shrink to fit narrow windows instead of overflowing.
  const columns = `minmax(0, ${panes.sidebar}px) 0 minmax(240px, 1fr)${inspector ? ` 0 minmax(0, ${panes.inspector}px)` : ''}`;
  return (
    <div className="module" style={{ gridTemplateColumns: columns }}>
      <aside className="sidebar">{sidebar}</aside>
      <Splitter label="Sidebar width" width={panes.sidebar} direction={1}
        onResize={(px) => setPaneWidth('sidebar', px)} onReset={() => setPaneWidth('sidebar', DEFAULT_PANES.sidebar)} />
      <main className="canvas-pane">{canvas}</main>
      {inspector && (
        <>
          <Splitter label="Inspector width" width={panes.inspector} direction={-1}
            onResize={(px) => setPaneWidth('inspector', px)} onReset={() => setPaneWidth('inspector', DEFAULT_PANES.inspector)} />
          <aside className="inspector">{inspector}</aside>
        </>
      )}
    </div>
  );
}
