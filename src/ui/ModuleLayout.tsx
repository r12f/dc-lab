import type { ReactNode } from 'react';

interface Props {
  sidebar: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
}

/** Three-pane module layout: sidebar | canvas | inspector. */
export function ModuleLayout({ sidebar, canvas, inspector }: Props) {
  return (
    <div className="module">
      <aside className="sidebar">{sidebar}</aside>
      <main className="canvas-pane">{canvas}</main>
      {inspector && <aside className="inspector">{inspector}</aside>}
    </div>
  );
}
