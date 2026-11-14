import { useAppStore } from '../state/store';
import { MODULES } from './modules';
import { ProjectMenu } from './project-menu';
import { ThemePicker } from './theme-picker';

export function TopBar() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  return (
    <header className="topbar">
      <div className="brand">DC Lab</div>
      <nav className="tabs">
        {MODULES.map((m) => (
          <button key={m.id} type="button" className={m.id === tab ? 'active' : ''} onClick={() => setTab(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <ProjectMenu />
      <ThemePicker />
    </header>
  );
}
