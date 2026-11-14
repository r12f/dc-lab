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
  /** Inspector width per module, overriding the shared one (e.g. Rack Designer is wider for its BOM). */
  inspectorWidths: Record<string, number>;
  setInspectorWidth(module: string, px: number | undefined): void;
  /** Height (px) of the item list above a sidebar's lower pane (Rack Designer: designs above the palette). */
  sidebarListHeight: number;
  setSidebarListHeight(px: number): void;
  resetPanes(): void;
}

export interface PaneWidths {
  sidebar: number;
  inspector: number;
}

export const DEFAULT_PANES: PaneWidths = { sidebar: 260, inspector: 360 };
/** Default inspector width per module where the shared default is too narrow. */
export const DEFAULT_INSPECTOR_WIDTHS: Record<string, number> = { designer: 640 };
export const DEFAULT_SIDEBAR_LIST_HEIGHT = 180;
export const LIST_HEIGHT_LIMITS = { min: 60, max: 1200 };
/** Inspector can grow to most of a wide screen so faceplates and port boxes stay legible. */
export const PANE_LIMITS = { min: 180, max: 1600 };

/** Inspector width for a module: its own stored width, else its default, else the shared width. */
export function inspectorWidthFor(module: string | undefined, panes: PaneWidths, widths: Record<string, number>): number {
  if (!module) return panes.inspector;
  return widths[module] ?? DEFAULT_INSPECTOR_WIDTHS[module] ?? panes.inspector;
}

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
      resetPanes: () => set({ panes: DEFAULT_PANES, inspectorWidths: {}, sidebarListHeight: DEFAULT_SIDEBAR_LIST_HEIGHT }),
      inspectorWidths: {},
      setInspectorWidth: (module, px) => set((s) => {
        const next = { ...s.inspectorWidths };
        if (px === undefined) delete next[module]; else next[module] = clampPane(px);
        return { inspectorWidths: next };
      }),
      sidebarListHeight: DEFAULT_SIDEBAR_LIST_HEIGHT,
      setSidebarListHeight: (px) => set({
        sidebarListHeight: Math.round(Math.min(LIST_HEIGHT_LIMITS.max, Math.max(LIST_HEIGHT_LIMITS.min, px))),
      }),
    }),
    {
      name: 'dc-lab:prefs',
      partialize: (s) => ({ themeId: s.themeId, panes: s.panes, inspectorWidths: s.inspectorWidths, sidebarListHeight: s.sidebarListHeight }),
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<Preferences>;
        return { ...current, ...s, panes: { ...DEFAULT_PANES, ...s.panes }, inspectorWidths: s.inspectorWidths ?? {} };
      },
    },
  ),
);
