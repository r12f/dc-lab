import { useAppStore } from '../state/store';
import { emptyProject } from '../domain/project/types';
import { parseProjectFile, serializeProject } from '../domain/project/serializer';
import { slugify } from '../domain/ids';
import { downloadText, pickTextFile } from '../io/download';
import { Button } from '../ui/Button';

/** New / Open / Import / Save for the single-file project. */
export function ProjectMenu() {
  const project = useAppStore((s) => s.project);
  const setProject = useAppStore((s) => s.setProject);
  const importProject = useAppStore((s) => s.importProject);
  const renameProject = useAppStore((s) => s.renameProject);

  const load = async (apply: (p: ReturnType<typeof parseProjectFile>) => void) => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      apply(parseProjectFile(text));
    } catch (e) {
      alert(`Could not read file: ${(e as Error).message}`);
    }
  };

  return (
    <div className="project-menu">
      <input className="project-name" value={project.name} onChange={(e) => renameProject(e.target.value)} title="Project name" />
      <Button onClick={() => confirm('Discard the current project?') && setProject(emptyProject())}>New</Button>
      <Button onClick={() => void load(setProject)} title="Replace the current project">Open</Button>
      <Button onClick={() => void load(importProject)} title="Merge a project or single device/rack file">Import</Button>
      <Button variant="primary" onClick={() => downloadText(`${slugify(project.name)}.dclab.json`, serializeProject(project))}>Save</Button>
    </div>
  );
}
