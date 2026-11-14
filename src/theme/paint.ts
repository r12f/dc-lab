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
 * Fixed, calm category colors (blues, teals, purples, greys) for rack elevations and palette swatches.
 * Deliberately not the theme highlight palette: that holds reds/yellows, which read as errors.
 * White text stays readable on every color.
 */
const CATEGORY_COLORS: Record<DeviceCategory, string> = {
  switch: '#3B6EA5',
  server: '#2F7F7A',
  pdu: '#5B6B7F',
  'patch-panel': '#6A5A8C',
  ocs: '#36719A',
  'power-shelf': '#4F5D73',
  storage: '#3F7F5F',
  tester: '#5B5F97',
  'console-server': '#4A7A8C',
  cdu: '#2E6F8E',
  bbu: '#55606E',
  other: '#64748B',
  'blanking-panel': '#1F2937',
  stiffener: '#64748B',
  reserved: '#94A3B8',
  'brush-panel': '#374151',
};

export function categoryPaint(category: DeviceCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}

/** Neutral outline of device faceplates; status colors (red/amber) are reserved for warnings. */
export const FACEPLATE_BORDER = '#64748B';
