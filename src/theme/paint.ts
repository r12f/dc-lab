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
    rackIt: '#9cc2ff', rackItLine: '#5b8ef0', rackItText: '#14275e',
    // IT racks: one candy colour per rack design (blue, pink, mint, lavender, aqua, lilac)
    rackIt0: '#a9c8ff', rackIt0Line: '#5b8ef0', rackIt0Text: '#14275e',
    rackIt1: '#ffc2e2', rackIt1Line: '#e46fae', rackIt1Text: '#5e1440',
    rackIt2: '#a6f0cf', rackIt2Line: '#2fb985', rackIt2Text: '#0b4431',
    rackIt3: '#d9c2ff', rackIt3Line: '#9466ec', rackIt3Text: '#2f1566',
    rackIt4: '#a5ecf5', rackIt4Line: '#25afc4', rackIt4Text: '#0b3f48',
    rackIt5: '#f3c4f7', rackIt5Line: '#c162cf', rackIt5Text: '#4f1659',
    rackPower: '#cfb0ff', rackPowerLine: '#9466ec', rackPowerText: '#2f1566',
    rackCdu: '#8fe6c4', rackCduLine: '#2fb985', rackCduText: '#0b4431',
    rackChiller: '#93dcf7', rackChillerLine: '#2fa9d6', rackChillerText: '#0b3b50',
    trace0: '#26c49b', trace1: '#9a66f2', trace2: '#78c63c', trace3: '#e467b8', trace4: '#1fb8cf', trace5: '#6b84f5',
  },
  dark: {
    rackIt: '#2f4a73', rackItLine: '#7d9cd1', rackItText: '#e3ecfa',
    rackIt0: '#2f4a73', rackIt0Line: '#7d9cd1', rackIt0Text: '#e3ecfa',
    rackIt1: '#2f4a73', rackIt1Line: '#7d9cd1', rackIt1Text: '#e3ecfa',
    rackIt2: '#2f4a73', rackIt2Line: '#7d9cd1', rackIt2Text: '#e3ecfa',
    rackIt3: '#2f4a73', rackIt3Line: '#7d9cd1', rackIt3Text: '#e3ecfa',
    rackIt4: '#2f4a73', rackIt4Line: '#7d9cd1', rackIt4Text: '#e3ecfa',
    rackIt5: '#2f4a73', rackIt5Line: '#7d9cd1', rackIt5Text: '#e3ecfa',
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
  /** IT rack look by design (light theme: a candy colour per design; other themes: all the same). */
  itRack: (i: number) => {
    const n = ((i % 6) + 6) % 6;
    return { fill: `var(--lay-rack-it${n})`, stroke: `var(--lay-rack-it${n}-line)`, text: `var(--lay-rack-it${n}-text)` };
  },
} as const;

/**
 * `--lay-…` variables for a theme: the light / dark themes get the layout palette above; every other theme keeps its
 * own look — IT racks in the theme accent with on-accent text and ink outline, infra racks in fixed slate / cyan —
 * and the scheme's trace colours.
 */
export function layoutColorVars(theme: { id: string; scheme: 'light' | 'dark'; general: { accent: string; onAccent: string }; canvas: { ink: string } }): Record<string, string> {
  const base: Record<string, string> = { ...LAYOUT_SETS[theme.scheme] };
  if (theme.id !== 'light' && theme.id !== 'dark') {
    Object.assign(base, {
      rackIt: theme.general.accent, rackItLine: theme.canvas.ink, rackItText: theme.general.onAccent,
      ...Object.fromEntries([0, 1, 2, 3, 4, 5].flatMap((i) => [
        [`rackIt${i}`, theme.general.accent], [`rackIt${i}Line`, theme.canvas.ink], [`rackIt${i}Text`, theme.general.onAccent]])),
      rackPower: '#475569', rackPowerLine: theme.canvas.ink, rackPowerText: theme.general.onAccent,
      rackCdu: '#06b6d4', rackCduLine: theme.canvas.ink, rackCduText: theme.general.onAccent,
      rackChiller: '#0e7490', rackChillerLine: theme.canvas.ink, rackChillerText: theme.general.onAccent,
    });
  }
  const v: Record<string, string> = {};
  for (const [k, c] of Object.entries(base)) v[`--lay-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
  return v;
}

/** `--rk-…` CSS variables of the rack colors for a scheme (merged into the theme's variables). */
export function rackColorVars(scheme: 'light' | 'dark'): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [cat, sets] of Object.entries(CATEGORY_SETS)) {
    const [fill, stroke, text] = sets[scheme];
    Object.assign(v, { [`--rk-${cat}-fill`]: fill, [`--rk-${cat}-stroke`]: stroke, [`--rk-${cat}-text`]: text });
  }
  for (const [k, c] of Object.entries(FRAME_SETS[scheme])) v[`--rk-frame-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
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
