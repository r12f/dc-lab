import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { normalizeProject } from '../domain/project/serializer';
import { createUiSlice, type UiSlice } from './uiSlice';
import { createFileSlice, type FileSlice } from './fileSlice';

export type AppState = ProjectSlice & UiSlice & FileSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({ ...createProjectSlice(...a), ...createUiSlice(...a), ...createFileSlice(...a) }),
    {
      name: 'dc-lab:autosave',
      version: 2,
      migrate: (persisted) => {
        const s = persisted as { project?: Record<string, unknown> };
        return { ...s, project: s.project ? normalizeProject(s.project) : undefined } as never;
      },
      partialize: (s) => ({ project: s.project, tab: s.tab, selected: s.selected }),
    },
  ),
);
