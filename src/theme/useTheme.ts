import { useEffect } from 'react';
import { usePreferences } from '../state/preferences';
import { applyTheme } from './cssVars';
import { findTheme, resolveTheme } from './registry';
import { useSystemScheme } from './systemScheme';
import type { Theme } from './types';

/** Active theme: the stored choice, else the system light/dark theme (live). */
export function useTheme(): Theme {
  return resolveTheme(usePreferences((s) => s.themeId), useSystemScheme());
}

/** True when the user has not picked a theme (following the system). */
export function useFollowsSystem(): boolean {
  return !findTheme(usePreferences((s) => s.themeId));
}

/** Applies the active theme's CSS variables to the document. Mount once at the app root. */
export function useApplyTheme(): void {
  const theme = useTheme();
  useEffect(() => applyTheme(theme), [theme]);
}
