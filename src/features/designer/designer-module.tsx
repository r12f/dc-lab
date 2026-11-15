import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { useLibrary } from '../../state/use-library';
import { newDesign } from '../../domain/design/factory';
import { slugify, uniqueId } from '../../domain/ids';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { Button } from '../../ui/button';
import { NewDesignForm } from './new-design-form';
import { DevicePalette } from './device-palette';
import { RackElevation } from './rack-elevation';
import { CablingView } from './cabling-view';
import { CableTypeMenu, DeviceFilterMenu, FaceMenu } from './device-filter-menu';
import type { ViewFilter } from '../../domain/design/device-filter';
import type { PortFace } from '../../domain/device/types';

const NO_FILTER: ViewFilter = { hiddenDevices: new Set(), hiddenCables: new Set() };
const BOTH_FACES: PortFace[] = ['front', 'rear'];
import { DesignInspector, type InspectorTab } from './design-inspector';
import { useDesignEditor } from './use-design-editor';
import { designIssues } from '../../domain/design/issues';

export function DesignerModule() {
  const lib = useLibrary();
  const designs = useAppStore((s) => s.project.rackDesigns);
  const selectedId = useAppStore((s) => s.selected.designer);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<'elevation' | 'cabling'>('elevation');
  const [placementId, setPlacementId] = useState<string>();
  const [cableId, setCableId] = useState<string>();
  const [tab, setTab] = useState<InspectorTab>('summary');
  // Device / cable-type filter per design, faces shown (session only).
  const [filterBy, setFilterBy] = useState<Record<string, ViewFilter>>({});
  const [faces, setFaces] = useState<PortFace[]>(BOTH_FACES);
  const [message, setMessage] = useState<string>();

  const design = designs.find((d) => d.id === selectedId);
  const filter = (design && filterBy[design.id]) || NO_FILTER;
  const editor = useDesignEditor(lib, design);
  const issueCount = design ? designIssues(lib, design).count : 0;

  const create = (name: string, templateId: string, abbr: string) => {
    const d = newDesign(uniqueId(slugify(name), designs.map((x) => x.id)), name, templateId, abbr);
    upsert('rackDesigns', d);
    select('designer', d.id);
    setCreating(false);
  };
  const duplicate = (id: string) => {
    const src = designs.find((d) => d.id === id);
    if (!src) return;
    const copy = { ...structuredClone(src), id: uniqueId(`${src.id}-copy`, designs.map((x) => x.id)), name: `${src.name} (copy)` };
    upsert('rackDesigns', copy);
    select('designer', copy.id);
  };
  const report = (error?: string) => setMessage(error);
  const setFilter = (f: ViewFilter) => { if (design) setFilterBy((m) => ({ ...m, [design.id]: f })); };
  const selectedPlacement = design?.placements.find((p) => p.id === placementId);
  const duplicateSelected = () => {
    if (!selectedPlacement) return;
    const r = editor.duplicatePlacement(selectedPlacement.id);
    report(r.error);
    if (r.id) setPlacementId(r.id);
  };
  const deleteSelected = () => {
    if (!selectedPlacement) return;
    editor.removePlacement(selectedPlacement.id);
    setPlacementId(undefined);
  };
  // Delete / Backspace removes, Ctrl+D duplicates the selected device (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dup = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd';
      if (!dup && e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (!selectedPlacement) return;
      e.preventDefault();
      if (dup) duplicateSelected();
      else deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const items = designs.map((d) => ({
    id: d.id,
    name: d.name,
    path: [lib.racks.get(d.templateId)?.name ?? d.templateId],
    keywords: d.placements.map((p) => `${p.label} ${lib.devices.get(p.deviceId)?.name ?? p.deviceId}`).join(' '),
    badge: `${d.abbr} · ${formatPower(computeRackMetrics(lib, d).typicalW)}`,
  }));

  return (
    <ModuleLayout
      module="designer"
      sidebar={
        <Sidebar
          title="Rack designs"
          items={items}
          filterable
          selectedId={selectedId}
          onSelect={(id) => { select('designer', id); setPlacementId(undefined); }}
          onNew={() => setCreating(true)}
          onDuplicate={duplicate}
          onDelete={(id) => { remove('rackDesigns', id); select('designer', undefined); }}
          emptyText="Create a rack design from a template."
          header={creating && <NewDesignForm lib={lib} onCreate={create} onCancel={() => setCreating(false)} />}
          lower={design && <DevicePalette lib={lib} rack={lib.racks.get(design.templateId)} onAdd={(id, variantId) => {
            const r = editor.addDevice(id, undefined, variantId);
            report(r.error);
            if (r.id) setPlacementId(r.id);
          }} />}
        />
      }
      canvas={
        design ? (
          <CanvasFrame
            title={design.name}
            exportName={`${design.id}-${view}`}
            viewControls={(
              <>
                <FaceMenu faces={faces} onChange={setFaces} />
                <DeviceFilterMenu lib={lib} design={design} filter={filter} onChange={setFilter} />
                <CableTypeMenu lib={lib} design={design} filter={filter} onChange={setFilter} />
              </>
            )}
            toolbar={
              <>
                {message && <span className="toolbar-msg">{message}</span>}
                {issueCount > 0 && <span className="toolbar-msg error" title="Marked in red on the rack">{`⚠ ${issueCount} problem${issueCount > 1 ? 's' : ''}`}</span>}
                <Button variant={view === 'elevation' ? 'primary' : 'default'} onClick={() => setView('elevation')}>Elevation</Button>
                <Button variant={view === 'cabling' ? 'primary' : 'default'} onClick={() => setView('cabling')}>Cabling</Button>
                <span className="toolbar-sep" />
                <Button disabled={!selectedPlacement} onClick={duplicateSelected}
                  aria-label="Duplicate device"
                  title={selectedPlacement ? `Duplicate ${selectedPlacement.label} (Ctrl+D)` : 'Select a device to duplicate it'}>⧉</Button>
                <Button variant="danger" disabled={!selectedPlacement} onClick={deleteSelected}
                  aria-label="Delete device"
                  title={selectedPlacement ? `Delete ${selectedPlacement.label} (Del)` : 'Select a device to delete it'}>✕</Button>
              </>
            }
          >
            {(ref) => view === 'cabling' ? (
              <CablingView ref={ref} lib={lib} design={design} editor={editor} selectedCableId={cableId} filter={filter} faces={faces}
                onSelectCable={(id) => { setCableId(id); if (id) { setPlacementId(undefined); setTab('cables'); } }} />
            ) : (
              <RackElevation
                ref={ref}
                lib={lib}
                design={design}
                selectedId={placementId}
                onSelect={(id) => { setPlacementId(id); if (id) setCableId(undefined); }}
                selectedCableId={cableId}
                onSelectCable={(id) => { setCableId(id); if (id) { setPlacementId(undefined); setTab('cables'); } }}
                onDropDevice={(deviceId, mount, variantId) => {
                  const r = editor.addDevice(deviceId, mount, variantId);
                  report(r.error);
                  if (r.id) setPlacementId(r.id);
                }}
                onMove={(id, mount) => report(editor.moveTo(id, mount))}
                filter={filter}
                faces={faces}
              />
            )}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a rack design." />
        )
      }
      inspector={
        design && (
          <DesignInspector lib={lib} design={design} editor={editor} placementId={placementId}
            onSelectPlacement={setPlacementId} tab={tab} onTabChange={setTab}
            cableId={cableId} onSelectCable={setCableId} onError={report} />
        )
      }
    />
  );
}
