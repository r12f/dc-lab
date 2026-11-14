import { useAppStore } from '../state/store';
import { emptyProject, type Project } from '../domain/project/types';
import { parseProjectFile, serializeProject } from '../domain/project/serializer';
import { slugify } from '../domain/ids';
import { projectFiles } from '../io/gateway';
import { isAbort } from '../io/file-gateway';
import { pickTextFile } from '../io/download';

function report(e: unknown, action: string) {
  if (!isAbort(e)) alert(`${action} failed: ${(e as Error).message}`);
}

/** Project file commands: New, Open, Import, Save, Save As. */
export function useProjectFile() {
  const project = useAppStore((s) => s.project);
  const file = useAppStore((s) => s.file);
  const dirty = useAppStore((s) => s.project !== s.savedProject);
  const setProject = useAppStore((s) => s.setProject);
  const importProject = useAppStore((s) => s.importProject);
  const bindFile = useAppStore((s) => s.bindFile);

  const confirmDiscard = () => !dirty || confirm('Discard unsaved changes to the current project?');

  const newProject = () => {
    if (!confirmDiscard()) return;
    const p = emptyProject();
    setProject(p);
    bindFile(undefined, p);
  };

  const open = async () => {
    if (!confirmDiscard()) return;
    try {
      const opened = await projectFiles.open();
      if (!opened) return;
      const p = parseProjectFile(opened.text);
      setProject(p);
      bindFile(projectFiles.canWriteBack ? opened.ref : undefined, p);
    } catch (e) {
      report(e, 'Open');
    }
  };

  const importFile = async () => {
    const picked = await pickTextFile();
    if (!picked) return;
    try {
      importProject(parseProjectFile(picked.text));
    } catch (e) {
      report(e, 'Import');
    }
  };

  const saveAs = async (p: Project = project) => {
    try {
      const ref = await projectFiles.saveAs(`${slugify(p.name)}.dclab.json`, serializeProject(p));
      if (ref) bindFile(projectFiles.canWriteBack ? ref : undefined, p);
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

  return { file, dirty, newProject, open, importFile, save, saveAs: () => saveAs() };
}
