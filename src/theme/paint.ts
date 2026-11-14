import type { DeviceCategory } from '../domain/device/types';
import { DEVICE_CATEGORIES } from '../domain/device/categories';

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
 * Category color from the highlight palette. Index modulo 6 matches the shortest built-in palette,
 * so every theme defines it.
 */
export function categoryPaint(category: DeviceCategory): string {
  return `var(--palette-${Math.max(0, DEVICE_CATEGORIES.indexOf(category)) % 6})`;
}
