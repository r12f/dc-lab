import type { Theme } from './types';
import { readableOn } from './color';

/**
 * The color slots a dark preset is defined by (names follow the preset color reference).
 * Every Theme field is derived from these so presets stay small and consistent.
 */
export interface DarkPresetColors {
  id: string;
  name: string;
  description: string;
  base: string;            // darkest background (alternating row / tab bar)
  raised: string;          // panel background (status line 1 / unfocused tab bg)
  selected: string;        // selected row
  border: string;
  separator: string;
  text: string;            // primary text (info level)
  textDim: string;         // secondary text (status line 1 fg)
  muted: string;           // tertiary text (unfocused tab fg)
  accent: string;
  focused: { fg: string; bg: string };
  danger: string;
  warn: string;
  ok: string;
  selection: string;       // cursor marker
  palette: string[];
}

export function darkTheme(c: DarkPresetColors): Theme {
  return {
    id: c.id, name: c.name, description: c.description, scheme: 'dark',
    general: { accent: c.accent, onAccent: readableOn(c.accent, c.focused.fg, c.text, c.base), text: c.text, muted: c.muted, subtle: c.separator, border: c.border },
    surface: { app: c.base, panel: c.raised, panelAlt: c.base, selected: c.selected, hover: c.selected, input: c.base, inputBorder: c.separator },
    tab: { focused: c.focused, unfocused: { fg: c.muted, bg: c.raised }, barBg: c.base },
    header: c.focused,
    status: { danger: c.danger, warn: c.warn, ok: c.ok },
    dialog: { border: c.accent, title: c.text, text: c.text, muted: c.muted, selected: { fg: c.text, bg: c.selected } },
    canvas: {
      paper: c.base, ink: c.text, inkMuted: c.textDim, grid: c.separator,
      frame: c.raised, frameText: c.textDim, slot: c.selected, selection: c.selection,
    },
    highlightPalette: c.palette,
  };
}
