/**
 * Recently used local project files, kept in IndexedDB. Browsers never expose a file's path; what survives a
 * reload is its File System Access handle (structured-cloneable), so the list stores handles. Reading one
 * again asks the browser for permission once per session. Not available without the File System Access API.
 */

const DB = 'dc-lab';
const STORE = 'recent-files';
export const MAX_RECENT = 10;

export interface RecentFile {
  /** File name (the browser gives no path). */
  name: string;
  handle: FileSystemFileHandle;
  /** ms since epoch, newest first. */
  usedAt: number;
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readList(): Promise<RecentFile[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get('list');
    req.onsuccess = () => resolve((req.result as RecentFile[] | undefined) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function writeList(list: RecentFile[]): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(list, 'list');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** The file the project is bound to, kept across reloads so Save keeps writing to it. */
export async function storeCurrentFile(handle: FileSystemFileHandle | undefined): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    if (handle) tx.objectStore(STORE).put(handle, 'current');
    else tx.objectStore(STORE).delete('current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCurrentFile(): Promise<FileSystemFileHandle | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get('current');
    req.onsuccess = () => resolve(req.result as FileSystemFileHandle | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function supportsRecentFiles(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/** Newest first, same file once (by handle identity), at most MAX_RECENT. */
export async function mergeRecent(list: RecentFile[], entry: RecentFile, same: (a: FileSystemFileHandle, b: FileSystemFileHandle) => Promise<boolean>): Promise<RecentFile[]> {
  const rest: RecentFile[] = [];
  for (const r of list) if (!(await same(r.handle, entry.handle))) rest.push(r);
  return [entry, ...rest].slice(0, MAX_RECENT);
}

export async function listRecent(): Promise<RecentFile[]> {
  if (!supportsRecentFiles()) return [];
  try { return await readList(); } catch { return []; }
}

export async function rememberFile(handle: FileSystemFileHandle): Promise<void> {
  if (!supportsRecentFiles()) return;
  const list = await readList();
  await writeList(await mergeRecent(list, { name: handle.name, handle, usedAt: Date.now() }, (a, b) => a.isSameEntry(b)));
}

export async function forgetFile(handle: FileSystemFileHandle): Promise<void> {
  const list = await readList();
  const rest: RecentFile[] = [];
  for (const r of list) if (!(await r.handle.isSameEntry(handle))) rest.push(r);
  await writeList(rest);
}

export async function clearRecent(): Promise<void> {
  await writeList([]);
}

/** Text of a remembered file; asks for read permission if this session has none yet. */
export async function readRecent(handle: FileSystemFileHandle): Promise<string> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?(o: object): Promise<PermissionState>;
    requestPermission?(o: object): Promise<PermissionState>;
  };
  const opts = { mode: 'read' };
  if (h.queryPermission && (await h.queryPermission(opts)) !== 'granted') {
    if (!h.requestPermission || (await h.requestPermission(opts)) !== 'granted') throw new Error('Read permission denied');
  }
  return (await handle.getFile()).text();
}
