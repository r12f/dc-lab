import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** App preferences that outlive projects (stored separately from the project autosave). */
export interface Preferences {
  /** Chosen theme id; undefined = follow the system light/dark setting. */
  themeId?: string;
  setTheme(id: string | undefined): void;
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
    }),
    { name: 'dc-lab:prefs', partialize: (s) => ({ themeId: s.themeId }) },
  ),
);
