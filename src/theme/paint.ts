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
 * Category styles for rack elevations and palette swatches, after the rack-elevation drawings: a pastel fill,
 * a mid-tone outline and text of the same hue (switch blue, console green, fillers grey, beige frame). Its
 * gold / orange / rose hues are swapped for non-alert ones (patch panel lavender, power slate violet, reserved
 * grey-blue): red / orange / yellow stay reserved for errors and warnings.
 * Two sets, picked by the theme's scheme (CSS variables `--rk-…`, set by `themeToCssVars`): light = light fill, dark
 * text; dark = deep muted fill of the same hue, brighter outline, light text.
 */
export interface CategoryStyle { fill: string; stroke: string; text: string }
type Set = [fill: string, stroke: string, text: string];
const CATEGORY_SETS: Record<DeviceCategory, { light: Set; dark: Set }> = {
  switch: { light: ['#cfe2f3', '#3d6ea8', '#12314f'], dark: ['#1f3550', '#5b8fcf', '#d6e6f7'] },
  ocs: { light: ['#d4e6f1', '#3a7ca5', '#123a52'], dark: ['#1d3a4c', '#5a9cc5', '#d3e8f4'] },
  'patch-panel': { light: ['#e6e0f3', '#7d6bb0', '#2e2452'], dark: ['#2f2a47', '#9585c9', '#e3ddf5'] },
  'console-server': { light: ['#d9ead3', '#4f8f40', '#1e3f16'], dark: ['#223a1f', '#6aae5a', '#d6ecd0'] },
  server: { light: ['#d0e8e4', '#3f8f86', '#14403b'], dark: ['#1b3936', '#5aaea4', '#d0ece8'] },
  storage: { light: ['#dbe9d8', '#5a8f50', '#21401b'], dark: ['#253824', '#74ab69', '#d9ead5'] },
  tester: { light: ['#e1dcf0', '#6a5aa8', '#2b2152'], dark: ['#2b2645', '#8676c4', '#e0dbf3'] },
  pdu: { light: ['#dfe0ee', '#6b6f9c', '#262a4d'], dark: ['#292b40', '#868bbc', '#dfe0f0'] },
  'power-shelf': { light: ['#d9dbea', '#5f6595', '#22264a'], dark: ['#26293f', '#7a80b5', '#dcdeef'] },
  'dc-pdu': { light: ['#dfe0ee', '#6b6f9c', '#262a4d'], dark: ['#292b40', '#868bbc', '#dfe0f0'] },
  cdu: { light: ['#d2e7f0', '#3c88a8', '#103b4d'], dark: ['#1c3743', '#5ba5c5', '#d2e9f2'] },
  chiller: { light: ['#d2e7f0', '#3c88a8', '#103b4d'], dark: ['#1c3743', '#5ba5c5', '#d2e9f2'] },
  other: { light: ['#e8e4f0', '#7a7290', '#2f2a3d'], dark: ['#2d2a36', '#958dab', '#e4e0ec'] },
  'blanking-panel': { light: ['#e2e2e2', '#a8a8a8', '#606060'], dark: ['#2e2e2e', '#5c5c5c', '#a8a8a8'] },
  'brush-panel': { light: ['#dadada', '#9a9a9a', '#555555'], dark: ['#2a2a2a', '#585858', '#a0a0a0'] },
  stiffener: { light: ['#d4d4d4', '#8f8f8f', '#4a4a4a'], dark: ['#333333', '#666666', '#b0b0b0'] },
  reserved: { light: ['#eef1f5', '#8a97a8', '#3a4554'], dark: ['#23272d', '#6f7c8d', '#b8c2cf'] },
};

/** Rack frame colors, after the rack-elevation drawings: warm rails / unit column, beige side pods (dark: deep taupe). */
const FRAME_SETS = {
  light: { rail: '#f5efe6', railLine: '#d8ccbb', railText: '#333333', side: '#f2ece2', sideLine: '#b5ad9f', sideText: '#4d4a44', sideSlot: '#fafafa' },
  dark: { rail: '#2a2825', railLine: '#4a4640', railText: '#c9c4bb', side: '#262421', sideLine: '#5e5850', sideText: '#bdb7ad', sideSlot: '#1e1d1b' },
} as const;

/**
 * DC Layout racks and cable traces per scheme. Light: a macaron palette — soft pastel racks with a deeper outline and
 * dark text of the same hue, traces in candy macaron tones (mint, lavender, pistachio, rose-pink, aqua, periwinkle).
 * Dark: deep muted racks of the same hues with light text, saturated traces. No red / orange / yellow (reserved for errors and warnings).
 */
const LAYOUT_SETS = {
  light: {
    rackIt: '#c9dbff', rackItLine: '#6f8fe8', rackItText: '#1f2f6b',
    rackPower: '#e5d5ff', rackPowerLine: '#9a6fe6', rackPowerText: '#3b2170',
    rackCdu: '#bdf2dc', rackCduLine: '#3fbf8f', rackCduText: '#0f4d37',
    rackChiller: '#c2ecfb', rackChillerLine: '#40b2dc', rackChillerText: '#0f4157',
    trace0: '#26c49b', trace1: '#9a66f2', trace2: '#78c63c', trace3: '#e467b8', trace4: '#1fb8cf', trace5: '#6b84f5',
  },
  dark: {
    rackIt: '#2f4a73', rackItLine: '#7d9cd1', rackItText: '#e3ecfa',
    rackPower: '#3b3a52', rackPowerLine: '#9890c4', rackPowerText: '#ebe8f7',
    rackCdu: '#1f4a43', rackCduLine: '#6fb9a6', rackCduText: '#dcf3ec',
    rackChiller: '#1e4352', rackChillerLine: '#6fadc2', rackChillerText: '#dceff5',
    trace0: '#10B981', trace1: '#D946EF', trace2: '#84CC16', trace3: '#A78BFA', trace4: '#2DD4BF', trace5: '#E879F9',
  },
} as const;

/** DC Layout paints (theme-scheme aware): `--lay-…` variables. */
export const LAYOUT_PAINT = {
  rack: {
    it: { fill: 'var(--lay-rack-it)', stroke: 'var(--lay-rack-it-line)', text: 'var(--lay-rack-it-text)' },
    power: { fill: 'var(--lay-rack-power)', stroke: 'var(--lay-rack-power-line)', text: 'var(--lay-rack-power-text)' },
    cdu: { fill: 'var(--lay-rack-cdu)', stroke: 'var(--lay-rack-cdu-line)', text: 'var(--lay-rack-cdu-text)' },
    chiller: { fill: 'var(--lay-rack-chiller)', stroke: 'var(--lay-rack-chiller-line)', text: 'var(--lay-rack-chiller-text)' },
  },
  traces: [0, 1, 2, 3, 4, 5].map((i) => `var(--lay-trace${i})`),
} as const;

/** `--rk-…` CSS variables of the rack colors for a scheme (merged into the theme's variables). */
export function rackColorVars(scheme: 'light' | 'dark'): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [cat, sets] of Object.entries(CATEGORY_SETS)) {
    const [fill, stroke, text] = sets[scheme];
    Object.assign(v, { [`--rk-${cat}-fill`]: fill, [`--rk-${cat}-stroke`]: stroke, [`--rk-${cat}-text`]: text });
  }
  for (const [k, c] of Object.entries(FRAME_SETS[scheme])) v[`--rk-frame-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
  for (const [k, c] of Object.entries(LAYOUT_SETS[scheme])) v[`--lay-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
  return v;
}

export function categoryStyle(category: DeviceCategory): CategoryStyle {
  const c = category in CATEGORY_SETS ? category : 'other';
  return { fill: `var(--rk-${c}-fill)`, stroke: `var(--rk-${c}-stroke)`, text: `var(--rk-${c}-text)` };
}

/** Category accent (outline color): swatches, legends. */
export function categoryPaint(category: DeviceCategory): string {
  return categoryStyle(category).stroke;
}

/** Rack frame paints (theme-scheme aware). */
export const RACK_FRAME = {
  rail: 'var(--rk-frame-rail)', railLine: 'var(--rk-frame-rail-line)', railText: 'var(--rk-frame-rail-text)',
  side: 'var(--rk-frame-side)', sideLine: 'var(--rk-frame-side-line)', sideText: 'var(--rk-frame-side-text)',
  sideSlot: 'var(--rk-frame-side-slot)',
} as const;

/** Neutral outline of device faceplates; status colors (red/amber) are reserved for warnings. */
export const FACEPLATE_BORDER = '#64748B';
