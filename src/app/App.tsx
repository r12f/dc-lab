import { useAppStore } from '../state/store';
import { MODULES } from './modules';
import { TopBar } from './TopBar';

export function App() {
  const tab = useAppStore((s) => s.tab);
  const Active = (MODULES.find((m) => m.id === tab) ?? MODULES[0]).component;
  return (
    <div className="app">
      <TopBar />
      <Active />
    </div>
  );
}
