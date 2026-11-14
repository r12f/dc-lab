import { usePreferences } from '../state/preferences';
import { THEMES } from '../theme/registry';
import { useFollowsSystem, useTheme } from '../theme/useTheme';

const SYSTEM = '__system';

/** Top-bar theme selector: System (follow OS light/dark) or a stored theme choice. */
export function ThemePicker() {
  const theme = useTheme();
  const followsSystem = useFollowsSystem();
  const setTheme = usePreferences((s) => s.setTheme);
  return (
    <select className="theme-picker" value={followsSystem ? SYSTEM : theme.id}
      title={followsSystem ? `System (${theme.name})` : theme.description}
      onChange={(e) => setTheme(e.target.value === SYSTEM ? undefined : e.target.value)}>
      <option value={SYSTEM} title="Follow the OS light/dark setting">{`System (${followsSystem ? theme.name : 'auto'})`}</option>
      {THEMES.map((t) => (
        <option key={t.id} value={t.id} title={t.description}>{t.name}</option>
      ))}
    </select>
  );
}
