import type { Theme } from './types';
import { mizuiro } from './presets/mizuiro';
import { landmine } from './presets/landmine';
import { amai } from './presets/amai';
import { maid } from './presets/maid';
import { gyaru } from './presets/gyaru';
import { dopamine } from './presets/dopamine';
import { light } from './presets/light';
import { dark } from './presets/dark';

export const THEMES: Theme[] = [mizuiro, landmine, amai, maid, gyaru, dopamine, light, dark];
export const DEFAULT_THEME_ID = mizuiro.id;

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}
