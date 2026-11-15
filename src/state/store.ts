import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createProjectSlice, type ProjectSlice } from './project-slice';
import { normalizeProject } from '../domain/project/serializer';
import { mergePersisted } from './merge-persisted';
import { createUiSlice, type UiSlice } from './ui-slice';
import { createFileSlice, type FileSlice } from './file-slice';

export type AppState = ProjectSlice & UiSlice & FileSlice;

/**
 * localStorage with debounced writes: the autosave serializes the whole project, so writing it on every change
 * (each selection click) stalls the UI on large projects. Writes coalesce for 400 ms and flush before unload.
 */
function debouncedLocalStorage(delayMs = 400): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    for (const [k, v] of pending) localStorage.setItem(k, v);
    pending.clear();
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush);
  return {
    getItem: (k) => pending.get(k) ?? localStorage.getItem(k),
    setItem: (k, v) => { pending.set(k, v); if (timer === undefined) timer = setTimeout(flush, delayMs); },
    removeItem: (k) => { pending.delete(k); localStorage.removeItem(k); },
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({ ...createProjectSlice(...a), ...createUiSlice(...a), ...createFileSlice(...a) }),
    {
      name: 'dc-lab:autosave',
      storage: createJSONStorage(() => debouncedLocalStorage()),
      version: 2,
      migrate: (persisted) => {
        const s = persisted as { project?: Record<string, unknown> };
        return { ...s, project: s.project ? normalizeProject(s.project) : undefined } as never;
      },
      // Always normalize the saved project, not only on version bumps: fields added since it was saved
      // (e.g. builtinProfiles) get their defaults instead of being undefined.
      merge: (persisted, current) => mergePersisted(persisted, current),
      partialize: (s) => ({ project: s.project, tab: s.tab, selected: s.selected }),
    },
  ),
);
