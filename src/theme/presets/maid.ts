import { darkTheme } from '../dark-theme-factory';

export const maid = darkTheme({
  id: 'maid',
  name: 'Maid',
  description: 'Classic maid: black and white high contrast with wine red',
  base: '#0D0D1A',
  raised: '#1A1A2E',
  selected: '#1E1E38',
  border: '#2A2A3E',
  separator: '#2A2A3E',
  text: '#F0EDE8',
  textDim: '#B0A8B9',
  muted: '#6B6B80',
  accent: '#8B2252',
  focused: { fg: '#0D0D1A', bg: '#F0EDE8' },
  danger: '#C43060',
  warn: '#D4A050',
  ok: '#B0A8B9',
  selection: '#3B82F6',
  palette: ['#F0EDE8', '#B0A8B9', '#C43060', '#8B2252', '#6880A0', '#6B6B80'],
});
