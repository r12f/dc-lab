import { useEffect } from 'react';
import type { LayoutEditor } from './use-layout-editor';
import { isElementSelection, type LayoutSelection } from './selection';
import { duplicateRacks } from './layout-toolbar';

const LIST = { row: 'rows', aisle: 'aisles', tray: 'trays', facility: 'facilities', door: 'doors' } as const;

/** Ctrl+D duplicates and Delete removes the selected racks/rows/aisles/trays/facilities (not while typing). */
export function useLayoutShortcuts(editor: LayoutEditor, sel: LayoutSelection | undefined,
  setSel: (s: LayoutSelection | undefined) => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (sel?.kind === 'assignment') {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateRacks(editor, sel.ids, setSel); }
        else if (e.key === 'Delete') { editor.unassignAll(sel.ids); setSel(undefined); }
        return;
      }
      if (!isElementSelection(sel)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setSel({ kind: sel.kind, ids: editor.duplicate(sel.kind, sel.ids) });
      } else if (e.key === 'Delete') {
        editor.removeElements(LIST[sel.kind], sel.ids);
        setSel(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, sel, setSel, active]);
}
