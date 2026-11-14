import { darkTheme } from '../darkThemeFactory';

export const gyaru = darkTheme({
  id: 'gyaru',
  name: 'Gyaru',
  description: 'Shibuya bold: dark bronze base with gold and hot pink',
  base: '#1A1208',
  raised: '#2A1F14',
  selected: '#3A2818',
  border: '#3A2A18',
  separator: '#3A2A18',
  text: '#FFF0D4',
  textDim: '#C68642',
  muted: '#A67C52',
  accent: '#FFD700',
  focused: { fg: '#1A1208', bg: '#FFD700' },
  danger: '#FF69B4',
  warn: '#FFE040',
  ok: '#FFD700',
  selection: '#FF2499',
  palette: ['#FF2499', '#FFD700', '#C68642', '#FF69B4', '#FFE040', '#8B6914'],
});
