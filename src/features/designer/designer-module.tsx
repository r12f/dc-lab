import { useState } from 'react';
import { useAppStore } from '../../state/store';
import { useLibrary } from '../../state/use-library';
import { newDesign } from '../../domain/design/factory';
import { slugify, uniqueId } from '../../domain/ids';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import type { PortFace } from '../../domain/device/types';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { Button } from '../../ui/button';
import { NewDesignForm } from './new-design-form';
import { DevicePalette } from './device-palette';
import { RackElevation } from './rack-elevation';
import { DesignInspector, type InspectorTab } from './design-inspector';
import { useDesignEditor } from './use-design-editor';

export function DesignerModule() {
  const lib = useLibrary();
  const designs = useAppStore((s) => s.project.rackDesigns);
  const selectedId = useAppStore((s) => s.selected.designer);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const [creating, setCreating] = useState(false);
  const [face, setFace] = useState<PortFace>('front');
  const [placementId, setPlacementId] = useState<string>();
  const [cableId, setCableId] = useState<string>();
  const [tab, setTab] = useState<InspectorTab>('summary');
  const [message, setMessage] = useState<string>();

  const design = designs.find((d) => d.id === selectedId);
  const editor = useDesignEditor(lib, design);

  const create = (name: string, templateId: string) => {
    const d = newDesign(uniqueId(slugify(name), designs.map((x) => x.id)), name, templateId);
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

  const items = designs.map((d) => ({
    id: d.id,
    name: d.name,
    path: [lib.racks.get(d.templateId)?.name ?? d.templateId],
    keywords: d.placements.map((p) => `${p.label} ${lib.devices.get(p.deviceId)?.name ?? p.deviceId}`).join(' '),
    badge: formatPower(computeRackMetrics(lib, d).typicalW),
  }));

  return (
    <ModuleLayout
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
          header={
            <>
              {creating && <NewDesignForm lib={lib} onCreate={create} onCancel={() => setCreating(false)} />}
              {design && <DevicePalette lib={lib} rack={lib.racks.get(design.templateId)} onAdd={(id, variantId) => {
                const r = editor.addDevice(id, undefined, variantId);
                report(r.error);
                if (r.id) setPlacementId(r.id);
              }} />}
            </>
          }
        />
      }
      canvas={
        design ? (
          <CanvasFrame
            title={design.name}
            exportName={`${design.id}-${face}`}
            toolbar={
              <>
                {message && <span className="toolbar-msg">{message}</span>}
                <Button variant={face === 'front' ? 'primary' : 'default'} onClick={() => setFace('front')}>Front</Button>
                <Button variant={face === 'rear' ? 'primary' : 'default'} onClick={() => setFace('rear')}>Rear</Button>
              </>
            }
          >
            {(ref) => (
              <RackElevation
                ref={ref}
                lib={lib}
                design={design}
                face={face}
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
            cableId={cableId} onSelectCable={setCableId} />
        )
      }
    />
  );
}
