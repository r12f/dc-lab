/** Rehydrated UI state over the initial state: only the module tab; a project stored by older versions is ignored. */
export function mergePersisted<T extends { tab: unknown }>(persisted: unknown, current: T): T {
  const s = (persisted ?? {}) as Partial<T>;
  return s.tab === undefined ? current : { ...current, tab: s.tab };
}
