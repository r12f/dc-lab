import { create } from 'zustand';
import type { TopoTrace } from '../domain/layout/topo-trace';

/** Drag offset of a top-level block of a trace drawing. */
export interface BlockOffset { dx: number; dy: number }

/** Topo traces of the session (not saved in the project), the one shown on the canvas, and dragged block offsets. */
interface TraceState {
  traces: TopoTrace[];
  openId?: string;
  /** trace id -> top-level block key -> offset from its automatic position. */
  offsets: Record<string, Record<string, BlockOffset>>;
  add(t: TopoTrace): void;
  remove(id: string): void;
  rename(id: string, name: string): void;
  open(id: string | undefined): void;
  setOffset(traceId: string, block: string, o: BlockOffset): void;
  resetOffsets(traceId: string): void;
}

export const useTraces = create<TraceState>()((set) => ({
  traces: [],
  offsets: {},
  add: (t) => set((s) => ({ traces: [...s.traces, t], openId: t.id })),
  remove: (id) => set((s) => {
    const { [id]: _gone, ...offsets } = s.offsets;
    return { traces: s.traces.filter((t) => t.id !== id), openId: s.openId === id ? undefined : s.openId, offsets };
  }),
  rename: (id, name) => set((s) => ({ traces: s.traces.map((t) => (t.id === id ? { ...t, name } : t)) })),
  open: (openId) => set({ openId }),
  setOffset: (traceId, block, o) => set((s) => ({ offsets: { ...s.offsets, [traceId]: { ...s.offsets[traceId], [block]: o } } })),
  resetOffsets: (traceId) => set((s) => ({ offsets: { ...s.offsets, [traceId]: {} } })),
}));
