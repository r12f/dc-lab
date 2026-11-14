import { useAppStore } from '../state/store';
import { THEMES } from '../theme/registry';
import { useTheme } from '../theme/useTheme';

/** Top-bar theme selector; the description shows as a tooltip. */
export function ThemePicker() {
  const theme = useTheme();
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <select className="theme-picker" value={theme.id} title={theme.description} onChange={(e) => setTheme(e.target.value)}>
      {THEMES.map((t) => (
        <option key={t.id} value={t.id} title={t.description}>{t.name}</option>
      ))}
    </select>
  );
}
