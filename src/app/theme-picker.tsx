import { usePreferences } from '../state/preferences';
import { SYSTEM_THEMES, THEMES } from '../theme/registry';
import { useFollowsSystem, useTheme } from '../theme/use-theme';

const SYSTEM = '__system';
const basic = [SYSTEM_THEMES.light, SYSTEM_THEMES.dark];
const option = (t: { id: string; name: string; description: string }) => (
  <option key={t.id} value={t.id} title={t.description}>{t.name}</option>
);

/** Top-bar theme selector: System (follow OS light/dark) or a stored theme choice. */
export function ThemePicker() {
  const theme = useTheme();
  const followsSystem = useFollowsSystem();
  const setTheme = usePreferences((s) => s.setTheme);
  return (
    <select className="theme-picker" value={followsSystem ? SYSTEM : theme.id}
      title={followsSystem ? `System (${theme.name})` : theme.description}
      onChange={(e) => setTheme(e.target.value === SYSTEM ? undefined : e.target.value)}>
      {/* Order: Light, Dark, System, then the style themes. */}
      {basic.map(option)}
      <option value={SYSTEM} title="Follow the OS light/dark setting">{`System (${followsSystem ? theme.name : 'auto'})`}</option>
      <option disabled>──────────</option>
      {THEMES.filter((t) => !basic.includes(t)).map(option)}
    </select>
  );
}
