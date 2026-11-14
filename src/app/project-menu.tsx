import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { Button } from '../ui/button';
import { useProjectFile } from './use-project-file';
import { RecentFilesMenu } from './recent-files-menu';

/** Project name, bound file, and New / Open ▾ (recent files) / Save / Save As. */
export function ProjectMenu() {
  const name = useAppStore((s) => s.project.name);
  const renameProject = useAppStore((s) => s.renameProject);
  const pf = useProjectFile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void (e.shiftKey ? pf.saveAs() : pf.save());
      } else if (k === 'r' && pf.canReload && !e.shiftKey) {
        // Reload the project file instead of the page.
        e.preventDefault();
        void pf.reload();
      } else if (k === 'o') {
        e.preventDefault();
        void pf.open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="project-menu">
      <input className="project-name" value={name} onChange={(e) => renameProject(e.target.value)} title="Project name" />
      <span className="file-name" title={pf.file ? 'Save writes to this file' : 'Not saved to a file yet'}>
        {`${pf.file?.name ?? 'unsaved'}${pf.dirty ? ' •' : ''}`}
      </span>
      <Button onClick={pf.newProject}>New</Button>
      <span className="split-btn">
        <Button onClick={() => void pf.open()} title="Open a project file (Ctrl+O)">Open</Button>
        <RecentFilesMenu onOpen={(h) => void pf.openRecent(h)} />
      </span>
      <Button className="btn-icon" disabled={!pf.canReload} onClick={() => void pf.reload()} aria-label="Reload"
        title={pf.canReload ? `Reload ${pf.file?.name} from disk (Ctrl+R)` : 'Open a file first'}>⟳</Button>
      <Button variant="primary" onClick={() => void pf.save()} title="Save (Ctrl+S)">Save</Button>
      <Button onClick={() => void pf.saveAs()} title="Save As (Ctrl+Shift+S)">Save As</Button>
    </div>
  );
}
