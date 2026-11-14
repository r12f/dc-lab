import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** App preferences that outlive projects (stored separately from the project autosave). */
export interface Preferences {
  /** Chosen theme id; undefined = follow the system light/dark setting. */
  themeId?: string;
  setTheme(id: string | undefined): void;
  /** Pane widths in px, shared by every module. */
  panes: PaneWidths;
  setPaneWidth(pane: keyof PaneWidths, px: number): void;
  resetPanes(): void;
}

export interface PaneWidths {
  sidebar: number;
  inspector: number;
}

export const DEFAULT_PANES: PaneWidths = { sidebar: 260, inspector: 360 };
export const PANE_LIMITS = { min: 180, max: 720 };

export function clampPane(px: number): number {
  return Math.round(Math.min(PANE_LIMITS.max, Math.max(PANE_LIMITS.min, px)));
}

/** Theme chosen by older versions, stored inside the project autosave. */
function legacyThemeId(): string | undefined {
  try {
    const raw = localStorage.getItem('dc-lab:autosave');
    return raw ? (JSON.parse(raw).state?.themeId as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      themeId: legacyThemeId(),
      setTheme: (themeId) => set({ themeId }),
      panes: DEFAULT_PANES,
      setPaneWidth: (pane, px) => set((s) => ({ panes: { ...s.panes, [pane]: clampPane(px) } })),
      resetPanes: () => set({ panes: DEFAULT_PANES }),
    }),
    {
      name: 'dc-lab:prefs',
      partialize: (s) => ({ themeId: s.themeId, panes: s.panes }),
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<Preferences>;
        return { ...current, ...s, panes: { ...DEFAULT_PANES, ...s.panes } };
      },
    },
  ),
);
