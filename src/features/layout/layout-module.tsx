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
import { Button } from '../../ui/button';
import { CrossCablingPanel, type CrossSides } from './cross-cabling-panel';
import { CheckMenu } from '../../ui/check-menu';
import { LAYOUT_VIEW_ITEMS, type LayoutViewItem } from './layout-view';

export function LayoutModule() {
  const lib = useLibrary();
  const designs = useDesignLookup();
  const layouts = useAppStore((s) => s.project.layouts);
  const selectedId = useAppStore((s) => s.selected.layout);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const [sel, setSel] = useState<LayoutSelection>();
  const [cabling, setCabling] = useState(false);
  const [sides, setSides] = useState<CrossSides>({});
  const [hiddenView, setHiddenView] = useState<Set<string>>(new Set());

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
            viewControls={<>
              <Button variant={cabling ? 'primary' : 'default'} aria-pressed={cabling}
                title="Cabling view: cross-rack cables between racks (A / B sides in the right panel)"
                onClick={() => setCabling(!cabling)}>⇄ Cabling</Button>
              <CheckMenu label="View" items={LAYOUT_VIEW_ITEMS} hidden={hiddenView} onChange={setHiddenView} noBulk compact
                title="Show or hide trays, floating trays, row labels and cable traces (drawing only; cables keep following hidden trays)" />
              <LayoutViewControls editor={editor} />
            </>}>
            {(ref) => <LayoutCanvas ref={ref} lib={lib} designs={designs} layout={layout} editor={editor} selection={sel} onSelect={setSel}
              crossSides={cabling ? [sides.a, sides.b].filter((x): x is string => !!x) : undefined}
              hidden={hiddenView as ReadonlySet<LayoutViewItem>} />}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a DC layout." />
        )
      }
      inspector={layout && (cabling
        ? <CrossCablingPanel lib={lib} designs={designs} layout={layout}
            selectedRackId={sel?.kind === 'assignment' && sel.ids.length === 1 ? sel.ids[0] : undefined}
            sides={sides} onSides={setSides} onChange={editor.setCrossCables} />
        : <LayoutInspector lib={lib} designs={designs} layout={layout} editor={editor}
            selection={sel} onSelect={setSel} />)}
    />
  );
}
