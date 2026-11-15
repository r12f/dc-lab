import type { DeviceCategory } from '../domain/device/types';

/**
 * SVG paints bound to the active theme via CSS variables.
 * Use these in drawings instead of color literals; exportSvg resolves them to concrete colors.
 */
export const paint = {
  paper: 'var(--canvas-paper)',
  ink: 'var(--canvas-ink)',
  inkMuted: 'var(--canvas-ink-muted)',
  grid: 'var(--canvas-grid)',
  frame: 'var(--canvas-frame)',
  frameText: 'var(--canvas-frame-text)',
  slot: 'var(--canvas-slot)',
  selection: 'var(--canvas-selection)',
  accent: 'var(--general-accent)',
  onAccent: 'var(--general-on-accent)',
  danger: 'var(--status-danger)',
  warn: 'var(--status-warn)',
  ok: 'var(--status-ok)',
  border: 'var(--general-border)',
} as const;

/**
 * Category styles for rack elevations and palette swatches, after the rack-elevation drawings: a light pastel fill,
 * a mid-tone outline and dark text of the same hue (switch blue, console green, fillers grey, beige frame). Its
 * gold / orange / rose hues are swapped for non-alert ones (patch panel lavender, power slate violet, reserved
 * grey-blue): red / orange / yellow stay reserved for errors and warnings. Fixed colors, independent of the theme.
 */
export interface CategoryStyle { fill: string; stroke: string; text: string }
const style = (fill: string, stroke: string, text: string): CategoryStyle => ({ fill, stroke, text });
const CATEGORY_STYLES: Record<DeviceCategory, CategoryStyle> = {
  switch: style('#cfe2f3', '#3d6ea8', '#12314f'),
  ocs: style('#d4e6f1', '#3a7ca5', '#123a52'),
  'patch-panel': style('#e6e0f3', '#7d6bb0', '#2e2452'),
  'console-server': style('#d9ead3', '#4f8f40', '#1e3f16'),
  server: style('#d0e8e4', '#3f8f86', '#14403b'),
  storage: style('#dbe9d8', '#5a8f50', '#21401b'),
  tester: style('#e1dcf0', '#6a5aa8', '#2b2152'),
  pdu: style('#dfe0ee', '#6b6f9c', '#262a4d'),
  'power-shelf': style('#d9dbea', '#5f6595', '#22264a'),
  'dc-pdu': style('#dfe0ee', '#6b6f9c', '#262a4d'),
  cdu: style('#d2e7f0', '#3c88a8', '#103b4d'),
  chiller: style('#d2e7f0', '#3c88a8', '#103b4d'),
  other: style('#e8e4f0', '#7a7290', '#2f2a3d'),
  'blanking-panel': style('#e2e2e2', '#a8a8a8', '#606060'),
  'brush-panel': style('#dadada', '#9a9a9a', '#555555'),
  stiffener: style('#d4d4d4', '#8f8f8f', '#4a4a4a'),
  reserved: style('#eef1f5', '#8a97a8', '#3a4554'),
};

export function categoryStyle(category: DeviceCategory): CategoryStyle {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;
}

/** Category accent (outline color): swatches, legends. */
export function categoryPaint(category: DeviceCategory): string {
  return categoryStyle(category).stroke;
}

/** Rack frame colors, after the rack-elevation drawings: warm rails / unit column, beige side pods. */
export const RACK_FRAME = {
  rail: '#f5efe6', railLine: '#d8ccbb', railText: '#333333',
  side: '#f2ece2', sideLine: '#b5ad9f', sideText: '#4d4a44',
} as const;

/** Neutral outline of device faceplates; status colors (red/amber) are reserved for warnings. */
export const FACEPLATE_BORDER = '#64748B';
