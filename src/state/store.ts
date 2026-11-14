import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

export type AppState = ProjectSlice & UiSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({ ...createProjectSlice(...a), ...createUiSlice(...a) }),
    {
      name: 'dc-lab:autosave',
      partialize: (s) => ({ project: s.project, tab: s.tab, selected: s.selected }),
    },
  ),
);
