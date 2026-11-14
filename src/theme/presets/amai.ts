import { darkTheme } from '../darkThemeFactory';

export const amai = darkTheme({
  id: 'amai',
  name: 'Amai',
  description: 'Sweet Lolita: dark rose base with candy pink and lavender',
  base: '#140A10',
  raised: '#3D2540',
  selected: '#3A1830',
  border: '#4A2E40',
  separator: '#4A2E40',
  text: '#E8D0DA',
  textDim: '#E8B8C8',
  muted: '#B08A9E',
  accent: '#FFC8D6',
  focused: { fg: '#140A10', bg: '#FFC8D6' },
  danger: '#E85A7A',
  warn: '#FFE8A0',
  ok: '#C8A2C8',
  selection: '#FF6B8A',
  palette: ['#FF6B8A', '#FFC8D6', '#C8A2C8', '#98D8C8', '#6B8EC2', '#FFE8A0'],
});
