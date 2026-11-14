import type { StateCreator } from 'zustand';

export type ModuleTab = 'devices' | 'racks' | 'designer' | 'layout';

export interface UiSlice {
  tab: ModuleTab;
  selected: Record<ModuleTab, string | undefined>;
  themeId?: string;
  setTheme(id: string): void;
  setTab(tab: ModuleTab): void;
  select(tab: ModuleTab, id: string | undefined): void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  tab: 'devices',
  selected: { devices: undefined, racks: undefined, designer: undefined, layout: undefined },
  themeId: undefined,
  setTheme: (themeId) => set({ themeId }),
  setTab: (tab) => set({ tab }),
  select: (tab, id) => set((s) => ({ selected: { ...s.selected, [tab]: id } })),
});
