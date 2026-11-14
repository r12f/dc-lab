import type { StateCreator } from 'zustand';
import { emptyProject, type Project } from '../domain/project/types';
import { mergeProjects } from '../domain/project/serializer';

export type ListKey = 'devices' | 'racks' | 'optics' | 'cableMedia' | 'rackDesigns' | 'layouts';
type ItemOf<K extends ListKey> = Project[K][number];

export interface ProjectSlice {
  project: Project;
  setProject(project: Project): void;
  importProject(incoming: Project): void;
  renameProject(name: string): void;
  upsert<K extends ListKey>(key: K, item: ItemOf<K>): void;
  update<K extends ListKey>(key: K, id: string, fn: (item: ItemOf<K>) => ItemOf<K>): void;
  remove(key: ListKey, id: string): void;
  hideBuiltin(id: string): void;
  restoreBuiltins(): void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  project: emptyProject(),
  setProject: (project) => set({ project }),
  importProject: (incoming) => set((s) => ({ project: mergeProjects(s.project, incoming) })),
  renameProject: (name) => set((s) => ({ project: { ...s.project, name } })),
  upsert: (key, item) =>
    set((s) => {
      const list = s.project[key] as { id: string }[];
      const exists = list.some((i) => i.id === item.id);
      const next = exists ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item];
      return { project: { ...s.project, [key]: next } };
    }),
  update: (key, id, fn) =>
    set((s) => {
      const list = s.project[key] as { id: string }[];
      const next = list.map((i) => (i.id === id ? (fn as (x: unknown) => { id: string })(i) : i));
      return { project: { ...s.project, [key]: next } };
    }),
  remove: (key, id) =>
    set((s) => ({
      project: { ...s.project, [key]: (s.project[key] as { id: string }[]).filter((i) => i.id !== id) },
    })),
  hideBuiltin: (id) =>
    set((s) => ({ project: { ...s.project, hiddenBuiltins: [...new Set([...s.project.hiddenBuiltins, id])] } })),
  restoreBuiltins: () => set((s) => ({ project: { ...s.project, hiddenBuiltins: [] } })),
});
