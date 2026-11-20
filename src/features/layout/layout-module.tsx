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
import { CrossCablingPanel, type CrossSides } from './cross-cabling-panel';
import { CheckMenu } from '../../ui/check-menu';
import { LAYOUT_VIEW_ITEMS, type LayoutViewItem } from './layout-view';
import { RackPalette } from './rack-palette';
import { assignmentAt } from '../../domain/layout/tiles';
import type { TileRef } from '../../domain/layout/assign';
import { TraceList, TracePanel, type TraceSides } from './trace-panel';
import { TraceView } from './trace-view';
import { useTraces } from '../../state/traces';
import { Segmented } from '../../ui/segmented';
import { Button } from '../../ui/button';

export function LayoutModule() {
  const lib = useLibrary();
  const designs = useDesignLookup();
  const layouts = useAppStore((s) => s.project.layouts);
  const selectedId = useAppStore((s) => s.selected.layout);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const [sel, setSel] = useState<LayoutSelection>();
  /** Canvas mode: the plan, cross-rack cabling, or topo tracing. */
  const [mode, setMode] = useState<'plan' | 'cabling' | 'tracing'>('plan');
  const cabling = mode === 'cabling';
  const tracing = mode === 'tracing';
  const [traceSides, setTraceSides] = useState<TraceSides>({});
  const traceId = useTraces((s) => s.openId);
  const openTrace = useTraces((s) => s.open);
  const allTraces = useTraces((s) => s.traces);
  const traceOffsets = useTraces((s) => s.offsets);
  const resetOffsets = useTraces((s) => s.resetOffsets);
  const hidePass = useTraces((s) => s.hidePass);
  const setHidePass = useTraces((s) => s.setHidePass);
  const [sides, setSides] = useState<CrossSides>({});
  const [hiddenView, setHiddenView] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string>();
  const rackDesigns = useAppStore((s) => s.project.rackDesigns);

  const layout = layouts.find((l) => l.id === selectedId);
  const shownTrace = tracing ? allTraces.find((t) => t.id === traceId && t.layoutId === layout?.id) : undefined;
  const editor = useLayoutEditor(lib, designs, layout);
  useLayoutShortcuts(editor, sel, setSel, !!layout);

  const create = () => {
    const l = newLayout(uniqueId(slugify('dc layout'), layouts.map((x) => x.id)), 'New DC layout');
    upsert('layouts', l);
    select('layout', l.id);
  };
  const selTiles: TileRef[] = sel?.kind === 'tile' ? sel.tiles : [];
  const freeTiles = layout ? selTiles.filter((t) => !assignmentAt(lib, designs, layout, t.rowId, t.tile)).length : 0;
  /** Assigns a design to tiles (palette Assign / drop): reports what was placed and what was skipped. */
  const assignTo = (tiles: TileRef[], designId: string) => {
    const r = editor.assignTiles(tiles, designId);
    if (r.ids.length) setSel({ kind: 'assignment', ids: r.ids });
    const n = `${r.ids.length} rack${r.ids.length === 1 ? '' : 's'} assigned`;
    return { error: r.ids.length === 0, lines: r.skipped.length ? [`${n}; skipped:`, ...r.skipped] : [n] };
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
          lower={layout && tracing ? <TraceList layoutId={layout.id} /> : layout && <RackPalette lib={lib} designs={rackDesigns} picked={picked} onPick={setPicked}
            freeTiles={freeTiles} onAssign={(id) => assignTo(selTiles, id)} />}
        />
      }
      canvas={
        layout ? (
          <CanvasFrame title={shownTrace ? `${layout.name} — ${shownTrace.name}` : layout.name}
            exportName={shownTrace ? `${layout.id}-${shownTrace.id}` : layout.id}
            fitKey={`${layout.id}:${layout.room.widthMm}x${layout.room.depthMm}:${layout.viewRotation ?? 0}:${shownTrace?.id ?? ''}`}
            toolbar={<LayoutToolbar layout={layout} editor={editor} selection={sel} onSelect={setSel} />}
            viewControls={<>
              {shownTrace && (
                <Button variant={hidePass ? 'primary' : 'default'} aria-pressed={hidePass}
                  title={hidePass ? 'Show fiber housings / patch panels again' : 'Hide fiber housings / patch panels: link straight through them'}
                  onClick={() => setHidePass(!hidePass)}>Hide pass-through</Button>
              )}
              {shownTrace && (
                <Button disabled={!Object.keys(traceOffsets[shownTrace.id] ?? {}).length}
                  title="Put every dragged block back in its automatic place" onClick={() => resetOffsets(shownTrace.id)}>↺ Reset layout</Button>
              )}
              <Segmented label="View mode" value={mode} onChange={(m) => { setMode(m); openTrace(undefined); }} options={[
                { value: 'plan', label: 'Layout', title: 'Layout: edit rows, aisles, trays and racks' },
                { value: 'cabling', label: 'Cabling', title: 'Cabling: cross-rack cables between racks (A / B sides in the right panel)' },
                { value: 'tracing', label: 'Tracing', title: 'Topo tracing: trace what is connected from an A side, optionally to a B side' },
              ]} />
              <CheckMenu label="View" items={LAYOUT_VIEW_ITEMS} hidden={hiddenView} onChange={setHiddenView} noBulk compact
                title="Show or hide trays, floating trays, row labels and cable traces (drawing only; cables keep following hidden trays)" />
              <LayoutViewControls editor={editor} />
            </>}>
            {(ref) => shownTrace ? <TraceView ref={ref} lib={lib} designs={designs} layout={layout} trace={shownTrace} /> : <LayoutCanvas ref={ref} lib={lib} designs={designs} layout={layout} editor={editor} selection={sel} onSelect={setSel}
              onDropRack={(designId, tile) => { const r = assignTo([tile], designId); if (r.error) alert(r.lines.join('\n')); }}
              crossSides={cabling ? [sides.a, sides.b].filter((x): x is string => !!x)
                : tracing ? [traceSides.a?.assignmentId, traceSides.b?.assignmentId].filter((x): x is string => !!x) : undefined}
              hidden={hiddenView as ReadonlySet<LayoutViewItem>} />}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a DC layout." />
        )
      }
      inspector={layout && (tracing
        ? <TracePanel lib={lib} designs={designs} layout={layout}
            selectedRackId={sel?.kind === 'assignment' && sel.ids.length === 1 ? sel.ids[0] : undefined}
            sides={traceSides} onSides={setTraceSides} />
        : cabling
        ? <CrossCablingPanel lib={lib} designs={designs} layout={layout}
            selectedRackId={sel?.kind === 'assignment' && sel.ids.length === 1 ? sel.ids[0] : undefined}
            sides={sides} onSides={setSides} onChange={editor.setCrossCables} />
        : <LayoutInspector lib={lib} designs={designs} layout={layout} editor={editor}
            selection={sel} onSelect={setSel} />)}
    />
  );
}
