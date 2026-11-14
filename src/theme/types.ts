export interface FgBg {
  fg: string;
  bg: string;
}

/** Every UI and canvas color of the app. See spec/07-themes.md for the area mapping. */
export interface Theme {
  id: string;
  name: string;
  description: string;
  scheme: 'light' | 'dark';
  general: { accent: string; onAccent: string; text: string; muted: string; subtle: string; border: string };
  surface: { app: string; panel: string; panelAlt: string; selected: string; hover: string; input: string; inputBorder: string };
  tab: { focused: FgBg; unfocused: FgBg; barBg: string };
  header: FgBg;
  status: { danger: string; warn: string; ok: string };
  dialog: { border: string; title: string; text: string; muted: string; selected: FgBg };
  canvas: {
    paper: string; ink: string; inkMuted: string; grid: string;
    frame: string; frameText: string; slot: string; selection: string;
  };
  highlightPalette: string[];
}
