import { darkTheme } from '../darkThemeFactory';

export const dopamine = darkTheme({
  id: 'dopamine',
  name: 'Dopamine',
  description: 'Rainbow maximalist: warm black base with neon pink, sunflower yellow, electric blue',
  base: '#1A1418',
  raised: '#241820',
  selected: '#2E1828',
  border: '#3A1828',
  separator: '#3A1828',
  text: '#FFF5E6',
  textDim: '#A89098',
  muted: '#A89098',
  accent: '#B388FF',
  focused: { fg: '#1A1418', bg: '#B388FF' },
  danger: '#FF6B9D',
  warn: '#FFD700',
  ok: '#4DA6FF',
  selection: '#FFD700',
  palette: ['#FF6B9D', '#FFD700', '#4DA6FF', '#B388FF', '#FF0000', '#A89098'],
});
