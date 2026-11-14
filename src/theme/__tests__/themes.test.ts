import { describe, expect, it } from 'vitest';
import { THEMES, resolveTheme } from '../registry';
import { themeToCssVars } from '../css-vars';
import { contrastRatio } from '../color';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('themes', () => {
  it('every theme defines every color as #RRGGBB and >= 6 palette entries', () => {
    for (const t of THEMES) {
      const vars = themeToCssVars(t);
      for (const [k, v] of Object.entries(vars)) expect(v, `${t.id} ${k}`).toMatch(HEX);
      expect(t.highlightPalette.length, t.id).toBeGreaterThanOrEqual(6);
      expect(t.description).not.toBe('');
    }
  });
  it('all themes expose the same variable names', () => {
    const keys = (id: string) => Object.keys(themeToCssVars(resolveTheme(id, 'light'))).filter((k) => !k.startsWith('--palette-')).sort();
    for (const t of THEMES) expect(keys(t.id)).toEqual(keys('light'));
  });
  it('text on accent, panel text and focused tab text reach 4.5:1', () => {
    for (const t of THEMES) {
      expect(contrastRatio(t.general.onAccent, t.general.accent), `${t.id} onAccent`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.general.text, t.surface.panel), `${t.id} text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.tab.focused.fg, t.tab.focused.bg), `${t.id} tab`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('follows the system scheme when nothing valid is chosen', () => {
    expect(resolveTheme(undefined, 'dark').id).toBe('dark');
    expect(resolveTheme(undefined, 'light').id).toBe('light');
    expect(resolveTheme('nope', 'dark').id).toBe('dark');
    expect(resolveTheme('amai', 'light').id).toBe('amai');
  });
});
