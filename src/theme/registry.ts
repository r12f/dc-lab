import type { Theme } from './types';
import type { Scheme } from './systemScheme';
import { mizuiro } from './presets/mizuiro';
import { landmine } from './presets/landmine';
import { amai } from './presets/amai';
import { maid } from './presets/maid';
import { gyaru } from './presets/gyaru';
import { dopamine } from './presets/dopamine';
import { light } from './presets/light';
import { dark } from './presets/dark';

export const THEMES: Theme[] = [light, dark, mizuiro, landmine, amai, maid, gyaru, dopamine];

/** Theme used when following the system setting. */
export const SYSTEM_THEMES: Record<Scheme, Theme> = { light, dark };

export function findTheme(id: string | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** The chosen theme, or the system light/dark theme when nothing (valid) is chosen. */
export function resolveTheme(id: string | undefined, scheme: Scheme): Theme {
  return findTheme(id) ?? SYSTEM_THEMES[scheme];
}
