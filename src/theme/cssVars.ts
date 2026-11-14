import type { Theme } from './types';

/** Flattens a theme into CSS custom properties, e.g. `--surface-panel`, `--tab-focused-bg`, `--palette-0`. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  const walk = (prefix: string, obj: unknown) => {
    if (typeof obj === 'string') vars[`--${prefix}`] = obj;
    else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) walk(prefix ? `${prefix}-${kebab(k)}` : kebab(k), v);
    }
  };
  const { id: _id, name: _n, description: _d, scheme: _s, highlightPalette, ...colors } = theme;
  void _id; void _n; void _d; void _s;
  walk('', colors);
  highlightPalette.forEach((c, i) => (vars[`--palette-${i}`] = c));
  return vars;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(themeToCssVars(theme))) root.style.setProperty(k, v);
  root.style.colorScheme = theme.scheme;
  root.dataset.theme = theme.id;
}
