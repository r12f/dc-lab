import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { applyTheme } from './cssVars';
import { themeById } from './registry';
import type { Theme } from './types';

export function useTheme(): Theme {
  return themeById(useAppStore((s) => s.themeId));
}

/** Applies the active theme's CSS variables to the document. Mount once at the app root. */
export function useApplyTheme(): void {
  const theme = useTheme();
  useEffect(() => applyTheme(theme), [theme]);
}
