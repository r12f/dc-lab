import type { StateCreator } from 'zustand';
import { emptyProject, type BuiltinProfiles, type Project } from '../domain/project/types';
import { mergeProjects } from '../domain/project/serializer';
import type { PropertyDef, PropertyValue } from '../domain/properties/types';
import { withValue } from '../domain/properties/properties';

export type ListKey = 'devices' | 'racks' | 'optics' | 'cableMedia' | 'variants' | 'rackDesigns' | 'layouts';
type ItemOf<K extends ListKey> = Project[K][number];

export interface ProjectSlice {
  project: Project;
  setProject(project: Project): void;
  importProject(incoming: Project): void;
  renameProject(name: string): void;
  upsert<K extends ListKey>(key: K, item: ItemOf<K>): void;
  update<K extends ListKey>(key: K, id: string, fn: (item: ItemOf<K>) => ItemOf<K>): void;
  remove(key: ListKey, id: string): void;
  upsertPropertyDef(def: PropertyDef): void;
  removePropertyDef(id: string): void;
  /** Sets a custom property value on a built-in device/rack (stored in the project). */
  setBuiltinProperty(itemId: string, propertyId: string, value: PropertyValue | undefined): void;
  /** Saves the breakout profiles of a built-in device (undefined = back to the built-in ones). */
  setBuiltinProfiles(deviceId: string, profiles: BuiltinProfiles | undefined): void;
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
  upsertPropertyDef: (def) =>
    set((s) => {
      const defs = s.project.propertyDefs;
      const next = defs.some((d) => d.id === def.id) ? defs.map((d) => (d.id === def.id ? def : d)) : [...defs, def];
      return { project: { ...s.project, propertyDefs: next } };
    }),
  removePropertyDef: (id) =>
    set((s) => ({ project: { ...s.project, propertyDefs: s.project.propertyDefs.filter((d) => d.id !== id) } })),
  setBuiltinProperty: (itemId, propertyId, value) =>
    set((s) => ({
      project: {
        ...s.project,
        builtinProperties: { ...s.project.builtinProperties, [itemId]: withValue(s.project.builtinProperties[itemId], propertyId, value) },
      },
    })),
  setBuiltinProfiles: (deviceId, profiles) =>
    set((s) => {
      const next = { ...s.project.builtinProfiles };
      if (profiles) next[deviceId] = profiles; else delete next[deviceId];
      return { project: { ...s.project, builtinProfiles: next } };
    }),
});
