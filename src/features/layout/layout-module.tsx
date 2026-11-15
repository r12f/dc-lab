import { useState } from 'react';
import { useAppStore } from '../../state/store';
import { useLibrary } from '../../state/use-library';
import { useDesignLookup } from '../../state/use-designs';
import { newLayout } from '../../domain/layout/factory';
import { slugify, uniqueId } from '../../domain/ids';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { LayoutCanvas } from './layout-canvas';
import { LayoutInspector } from './layout-inspector';
import { LayoutToolbar, LayoutViewControls } from './layout-toolbar';
import { useLayoutShortcuts } from './use-layout-shortcuts';
import { useLayoutEditor } from './use-layout-editor';
import type { LayoutSelection } from './selection';

export function LayoutModule() {
  const lib = useLibrary();
  const designs = useDesignLookup();
  const layouts = useAppStore((s) => s.project.layouts);
  const selectedId = useAppStore((s) => s.selected.layout);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const [sel, setSel] = useState<LayoutSelection>();

  const layout = layouts.find((l) => l.id === selectedId);
  const editor = useLayoutEditor(lib, designs, layout);
  useLayoutShortcuts(editor, sel, setSel, !!layout);

  const create = () => {
    const l = newLayout(uniqueId(slugify('dc layout'), layouts.map((x) => x.id)), 'New DC layout');
    upsert('layouts', l);
    select('layout', l.id);
  };
  const duplicate = (id: string) => {
    const src = layouts.find((l) => l.id === id);
    if (!src) return;
    const copy = { ...structuredClone(src), id: uniqueId(`${src.id}-copy`, layouts.map((x) => x.id)), name: `${src.name} (copy)` };
    upsert('layouts', copy);
    select('layout', copy.id);
  };

  return (
    <ModuleLayout
      sidebar={
        <Sidebar
          title="DC layouts"
          items={layouts.map((l) => ({
            id: l.id, name: l.name, path: [], badge: `${l.assignments.length} racks`,
            keywords: [...l.rows.map((r) => r.name), ...l.assignments.map((a) => a.label)].join(' '),
          }))}
          filterable
          selectedId={selectedId}
          onSelect={(id) => { select('layout', id); setSel(undefined); }}
          onNew={create}
          onDuplicate={duplicate}
          onDelete={(id) => { remove('layouts', id); select('layout', undefined); }}
          emptyText="Create a DC layout."
        />
      }
      canvas={
        layout ? (
          <CanvasFrame title={layout.name} exportName={layout.id}
            fitKey={`${layout.id}:${layout.room.widthMm}x${layout.room.depthMm}:${layout.viewRotation ?? 0}`}
            toolbar={<LayoutToolbar layout={layout} editor={editor} selection={sel} onSelect={setSel} />}
            viewControls={<LayoutViewControls editor={editor} />}>
            {(ref) => <LayoutCanvas ref={ref} lib={lib} designs={designs} layout={layout} editor={editor} selection={sel} onSelect={setSel} />}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a DC layout." />
        )
      }
      inspector={layout && <LayoutInspector lib={lib} designs={designs} layout={layout} editor={editor}
        selection={sel} onSelect={setSel} />}
    />
  );
}
