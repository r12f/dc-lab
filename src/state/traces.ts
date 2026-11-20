import { create } from 'zustand';
import type { TopoTrace } from '../domain/layout/topo-trace';

/** Topo traces of the session (not saved in the project) and the one shown on the canvas. */
interface TraceState {
  traces: TopoTrace[];
  openId?: string;
  add(t: TopoTrace): void;
  remove(id: string): void;
  rename(id: string, name: string): void;
  open(id: string | undefined): void;
}

export const useTraces = create<TraceState>()((set) => ({
  traces: [],
  add: (t) => set((s) => ({ traces: [...s.traces, t], openId: t.id })),
  remove: (id) => set((s) => ({ traces: s.traces.filter((t) => t.id !== id), openId: s.openId === id ? undefined : s.openId })),
  rename: (id, name) => set((s) => ({ traces: s.traces.map((t) => (t.id === id ? { ...t, name } : t)) })),
  open: (openId) => set({ openId }),
}));
