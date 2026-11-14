import { darkTheme } from '../darkThemeFactory';

export const mizuiro = darkTheme({
  id: 'mizuiro',
  name: 'Mizuiro',
  description: 'Clear aqua: deep navy base with water blue and sky blue (default)',
  base: '#0A1628',
  raised: '#0F2038',
  selected: '#162E48',
  border: '#1E3A50',
  separator: '#1E3A50',
  text: '#C8D6E5',
  textDim: '#8BA4B8',
  muted: '#4A7B9D',
  accent: '#5BA4CF',
  focused: { fg: '#0A1628', bg: '#5BA4CF' },
  danger: '#CF6B5E',
  warn: '#E8A74E',
  ok: '#7BC8F6',
  selection: '#7BC8F6',
  palette: ['#7BC8F6', '#5BA4CF', '#A8D8EA', '#2E6B9E', '#D4EEF6', '#4A7B9D'],
});
