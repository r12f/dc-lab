import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { useMaximize } from '../state/maximize';
import { MODULES } from './modules';
import { TopBar } from './top-bar';
import { useApplyTheme } from '../theme/use-theme';
import { usePreferences } from '../state/preferences';

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
  // Ctrl+[ / Ctrl+] collapse or expand the sidebar / inspector.
  const togglePane = usePreferences((s) => s.togglePane);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key === '[') { e.preventDefault(); togglePane('sidebar'); }
      else if (e.key === ']') { e.preventDefault(); togglePane('inspector'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePane]);
  return (
    <div className={`app${maximized ? ' maximized' : ''}`}>
      {!maximized && <TopBar />}
      <Active />
    </div>
  );
}
