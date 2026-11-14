import type { StateCreator } from 'zustand';
import type { FileRef } from '../io/file-gateway';

/** The file the project is bound to (not persisted: handles do not survive reloads). */
export interface FileSlice {
  file?: FileRef;
  /** Project object last written to / read from `file`; differs from `project` when dirty. */
  savedProject?: unknown;
  bindFile(file: FileRef | undefined, savedProject: unknown): void;
}

export const createFileSlice: StateCreator<FileSlice, [], [], FileSlice> = (set) => ({
  file: undefined,
  savedProject: undefined,
  bindFile: (file, savedProject) => set({ file, savedProject }),
});
