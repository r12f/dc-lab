import { useAppStore } from '../state/store';
import { MODULES } from './modules';
import { TopBar } from './top-bar';
import { useApplyTheme } from '../theme/use-theme';

export function App() {
  useApplyTheme();
  const tab = useAppStore((s) => s.tab);
  const Active = (MODULES.find((m) => m.id === tab) ?? MODULES[0]).component;
  return (
    <div className="app">
      <TopBar />
      <Active />
    </div>
  );
}
