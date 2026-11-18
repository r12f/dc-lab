import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createProjectSlice, type ProjectSlice } from './project-slice';
import { mergePersisted } from './merge-persisted';
import { createUiSlice, type UiSlice } from './ui-slice';
import { createFileSlice, type FileSlice } from './file-slice';

export type AppState = ProjectSlice & UiSlice & FileSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({ ...createProjectSlice(...a), ...createUiSlice(...a), ...createFileSlice(...a) }),
    {
      // Only the open module tab survives a page reload. The project lives in its file, never in the browser:
      // a reload starts empty and the file is opened again (Open / Open ▾ recent). Same key, so the old project
      // autosave stored under it is overwritten on first write.
      name: 'dc-lab:autosave',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted) => persisted as never,
      merge: (persisted, current) => mergePersisted(persisted, current),
      partialize: (s) => ({ tab: s.tab }),
    },
  ),
);
