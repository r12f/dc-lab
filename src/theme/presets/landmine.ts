import { darkTheme } from '../dark-theme-factory';

export const landmine = darkTheme({
  id: 'landmine',
  name: 'Landmine',
  description: 'Jirai Kei: black base with pink and red accents',
  base: '#0D060B',
  raised: '#1A0A14',
  selected: '#2D1028',
  border: '#3D1A30',
  separator: '#4A2040',
  text: '#C8C8C8',
  textDim: '#D4A0B9',
  muted: '#8A6A7E',
  accent: '#E8577E',
  focused: { fg: '#0D060B', bg: '#E8577E' },
  danger: '#E8577E',
  warn: '#F5A0C0',
  ok: '#D4A0B9',
  selection: '#FF3366',
  palette: ['#FF3366', '#F5A0C0', '#D4A0B9', '#E8577E', '#F5D0E0', '#8A6A7E'],
});
