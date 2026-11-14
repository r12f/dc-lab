/** A file the user chose; opaque to callers. */
export interface FileRef {
  name: string;
}

export interface OpenedFile {
  ref: FileRef;
  text: string;
}

/**
 * Reads and writes user-chosen text files. Implementations differ by browser capability
 * (strategy pattern): real file handles where supported, upload/download otherwise.
 */
export interface FileGateway {
  /** True when `save` can write back to an opened file without asking again. */
  readonly canWriteBack: boolean;
  open(): Promise<OpenedFile | undefined>;
  /** Writes to `ref`. */
  save(ref: FileRef, text: string): Promise<void>;
  /** Asks for a location, writes, and returns the new ref. */
  saveAs(suggestedName: string, text: string): Promise<FileRef | undefined>;
}

/** True when the user dismissed a picker (not an error worth reporting). */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
