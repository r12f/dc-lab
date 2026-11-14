import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { useMaximize } from '../state/maximize';
import { MODULES } from './modules';
import { TopBar } from './top-bar';
import { useApplyTheme } from '../theme/use-theme';

export function App() {
  useApplyTheme();
  const tab = useAppStore((s) => s.tab);
  const Active = (MODULES.find((m) => m.id === tab) ?? MODULES[0]).component;
  const maximized = useMaximize((s) => s.maximized);
  const setMaximized = useMaximize((s) => s.setMaximized);
  // Esc restores the normal layout.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximized(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized, setMaximized]);
  return (
    <div className={`app${maximized ? ' maximized' : ''}`}>
      {!maximized && <TopBar />}
      <Active />
    </div>
  );
}
