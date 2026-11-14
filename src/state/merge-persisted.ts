import { normalizeProject } from '../domain/project/serializer';

/** Rehydrated autosave over the initial state, with the project normalized (missing fields defaulted). */
export function mergePersisted<T extends { project: unknown }>(persisted: unknown, current: T): T {
  const s = (persisted ?? {}) as Partial<T> & { project?: Record<string, unknown> };
  return { ...current, ...s, project: s.project ? normalizeProject(s.project) : current.project };
}
