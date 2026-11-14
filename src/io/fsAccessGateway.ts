import type { FileGateway, FileRef, OpenedFile } from './fileGateway';

interface HandleRef extends FileRef {
  handle: FileSystemFileHandle;
}

const TYPES = [{ description: 'DC Lab project', accept: { 'application/json': ['.json'] } }];

/** Minimal typing for the File System Access API (Chromium only, not in lib.dom). */
interface FsWindow {
  showOpenFilePicker(o: object): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(o: object): Promise<FileSystemFileHandle>;
}

const fsWindow = () => window as unknown as FsWindow;

export function supportsFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

async function ensureWritable(handle: FileSystemFileHandle): Promise<void> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?(o: object): Promise<PermissionState>;
    requestPermission?(o: object): Promise<PermissionState>;
  };
  const opts = { mode: 'readwrite' };
  if (h.queryPermission && (await h.queryPermission(opts)) === 'granted') return;
  if (h.requestPermission && (await h.requestPermission(opts)) !== 'granted') throw new Error('Write permission denied');
}

async function write(handle: FileSystemFileHandle, text: string): Promise<void> {
  await ensureWritable(handle);
  const stream = await handle.createWritable();
  await stream.write(text);
  await stream.close();
}

/** File System Access API: real handles, Save writes in place. */
export const fsAccessGateway: FileGateway = {
  canWriteBack: true,
  async open(): Promise<OpenedFile | undefined> {
    const [handle] = await fsWindow().showOpenFilePicker({ types: TYPES, multiple: false });
    if (!handle) return undefined;
    const text = await (await handle.getFile()).text();
    return { ref: { name: handle.name, handle } as HandleRef, text };
  },
  async save(ref, text) {
    await write((ref as HandleRef).handle, text);
  },
  async saveAs(suggestedName, text) {
    const handle = await fsWindow().showSaveFilePicker({ suggestedName, types: TYPES });
    await write(handle, text);
    return { name: handle.name, handle } as HandleRef;
  },
};
