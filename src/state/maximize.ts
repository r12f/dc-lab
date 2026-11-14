import { create } from 'zustand';

/** Canvas maximized: top bar and side panes hidden (session only, not saved). */
interface MaximizeState {
  maximized: boolean;
  setMaximized(on: boolean): void;
}

export const useMaximize = create<MaximizeState>()((set) => ({
  maximized: false,
  setMaximized: (maximized) => set({ maximized }),
}));
