import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { emptyProject, type Project } from '../domain/project/types';
import { parseProjectFile, serializeProject } from '../domain/project/serializer';
import { slugify } from '../domain/ids';
import { projectFiles } from '../io/gateway';
import { isAbort } from '../io/file-gateway';
import { forgetFile, loadCurrentFile, readRecent, rememberFile, storeCurrentFile, supportsRecentFiles } from '../io/recent-files';

/** Handle behind a file ref (File System Access API only). */
const handleOf = (ref: unknown): FileSystemFileHandle | undefined => (ref as { handle?: FileSystemFileHandle } | undefined)?.handle;
const remember = (ref: unknown) => { const h = handleOf(ref); if (h) void rememberFile(h).catch(() => undefined); };

/** Restoring the bound file from the last session (once per page load). */
let restored: Promise<void> | undefined;

function report(e: unknown, action: string) {
  if (!isAbort(e)) alert(`${action} failed: ${(e as Error).message}`);
}

/** Project file commands: New, Open (+ recent), Save, Save As. */
export function useProjectFile() {
  const project = useAppStore((s) => s.project);
  const file = useAppStore((s) => s.file);
  const dirty = useAppStore((s) => s.project !== s.savedProject);
  const setProject = useAppStore((s) => s.setProject);
  const bindFile = useAppStore((s) => s.bindFile);

  // The bound file survives reloads (the project itself comes back from autosave): Save keeps writing to it
  // instead of asking for a file again. Restored once on start; stored whenever the binding changes.
  useEffect(() => {
    if (!supportsRecentFiles()) return;
    if (!restored) {
      // Restore first; storing the (still empty) binding before that would erase the saved one.
      restored = loadCurrentFile().then((h) => {
        const s = useAppStore.getState();
        if (h && !s.file) s.bindFile({ name: h.name, handle: h } as never, s.project);
      }).catch(() => undefined);
      return;
    }
    void restored.then(() => storeCurrentFile(handleOf(useAppStore.getState().file))).catch(() => undefined);
  }, [file]);

  const confirmDiscard = () => !dirty || confirm('Discard unsaved changes to the current project?');

  const newProject = () => {
    if (!confirmDiscard()) return;
    const p = emptyProject();
    setProject(p);
    bindFile(undefined, p);
  };

  // Open replaces the current project with the file (a clean start, no prompt); Save then writes to that file.
  const open = async () => {
    try {
      const opened = await projectFiles.open();
      if (!opened) return;
      const p = parseProjectFile(opened.text);
      setProject(p);
      bindFile(projectFiles.canWriteBack ? opened.ref : undefined, p);
      remember(opened.ref);
    } catch (e) {
      report(e, 'Open');
    }
  };

  /** Re-reads the open file from disk (after editing it outside the app): replaces the project, no prompt. */
  const reload = async () => {
    const h = handleOf(file);
    if (!h) return;
    await openRecent(h);
  };

  /** Opens a previously used local file (from the recent list); Save then writes back to it. */
  const openRecent = async (handle: FileSystemFileHandle) => {
    try {
      const p = parseProjectFile(await readRecent(handle));
      setProject(p);
      bindFile({ name: handle.name, handle } as never, p);
      void rememberFile(handle).catch(() => undefined);
    } catch (e) {
      if (isAbort(e)) return;
      if ((e as DOMException).name === 'NotFoundError') {
        alert(`${handle.name} no longer exists; removed from the recent list.`);
        void forgetFile(handle).catch(() => undefined);
      } else report(e, 'Open');
    }
  };

  const saveAs = async (p: Project = project) => {
    try {
      const ref = await projectFiles.saveAs(`${slugify(p.name)}.dclab.json`, serializeProject(p));
      if (ref) { bindFile(projectFiles.canWriteBack ? ref : undefined, p); remember(ref); }
    } catch (e) {
      report(e, 'Save As');
    }
  };

  const save = async () => {
    if (!file) return saveAs();
    try {
      await projectFiles.save(file, serializeProject(project));
      bindFile(file, project);
    } catch (e) {
      report(e, 'Save');
    }
  };

  return { file, dirty, newProject, open, openRecent, reload, canReload: !!handleOf(file), save, saveAs: () => saveAs() };
}
