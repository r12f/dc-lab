import type { StateCreator } from 'zustand';

export type ModuleTab = 'devices' | 'racks' | 'optics' | 'designer' | 'layout';

export interface UiSlice {
  tab: ModuleTab;
  selected: Record<ModuleTab, string | undefined>;
  setTab(tab: ModuleTab): void;
  select(tab: ModuleTab, id: string | undefined): void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  tab: 'devices',
  selected: { devices: undefined, racks: undefined, optics: undefined, designer: undefined, layout: undefined },
  setTab: (tab) => set({ tab }),
  select: (tab, id) => set((s) => ({ selected: { ...s.selected, [tab]: id } })),
});
