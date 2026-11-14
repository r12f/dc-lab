import { darkTheme } from '../dark-theme-factory';

export const dark = darkTheme({
  id: 'dark',
  name: 'Dark',
  description: 'Dark: GitHub-style near-black with light blue accent',
  base: '#0D1117',
  raised: '#1B2838',
  selected: '#2A3F55',
  border: '#3B4252',
  separator: '#3B4252',
  text: '#D4D4D4',
  textDim: '#A0A0A0',
  muted: '#6B7B8D',
  accent: '#4FC3F7',
  focused: { fg: '#1B2838', bg: '#4FC3F7' },
  danger: '#FF6B6B',
  warn: '#FFD93D',
  ok: '#6BCB77',
  selection: '#38BDF8',
  palette: ['#FF6B6B', '#6BCB77', '#4FC3F7', '#FFD93D', '#CE93D8', '#4DD0E1'],
});
