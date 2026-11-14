import { useState } from 'react';
import { useLibrary } from '../../state/use-library';
import { useCatalogEditor } from '../../state/use-catalog-editor';
import { newRack, RACK_KINDS } from '../../domain/rack/types';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { RackTemplateDrawing } from './rack-template-drawing';
import { RackInspector } from './rack-inspector';


export function RacksModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('racks', 'racks', lib.racks);
  const rack = ed.selected;
  const [elementId, setElementId] = useState<string>();
  const items = lib.racks.all().map(({ item, source }) => ({
    id: item.id,
    name: item.name,
    path: [RACK_KINDS[item.kind] ?? item.kind],
    keywords: `${item.kind} ${item.units}${item.unitSystem} ${item.widthMm}mm ${item.sideElements.map((e) => e.name).join(' ')}`,
    badge: `${item.units}${item.unitSystem}${source === 'project' ? ' *' : ''}`,
  }));
  return (
    <ModuleLayout
      sidebar={<Sidebar title="Rack templates" items={items} filterable selectedId={ed.selectedId} onSelect={(id) => { ed.select(id); setElementId(undefined); }}
        onNew={() => ed.create('new-rack', newRack)} onDuplicate={ed.duplicate} onDelete={ed.del} canDelete={ed.canDelete} />}
      canvas={rack ? (
        <CanvasFrame title={rack.name} exportName={rack.id}>
          {(ref) => <RackTemplateDrawing ref={ref} rack={rack} selectedElementId={elementId} onElementClick={setElementId} />}
        </CanvasFrame>
      ) : <EmptyCanvas text="Select or create a rack template." />}
      inspector={rack && <RackInspector rack={rack} readOnly={ed.readOnly} onChange={ed.save}
        onDuplicate={() => ed.duplicate(rack.id)}
        selectedElementId={elementId} onSelectElement={setElementId} />}
    />
  );
}
