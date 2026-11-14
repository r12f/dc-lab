import { useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useCatalogEditor } from '../../state/useCatalogEditor';
import { newRack, RACK_KINDS } from '../../domain/rack/types';
import { ModuleLayout } from '../../ui/ModuleLayout';
import { Sidebar } from '../../ui/Sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/CanvasFrame';
import { RackTemplateDrawing } from './RackTemplateDrawing';
import { RackInspector } from './RackInspector';

export function RacksModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('racks', 'racks', lib.racks);
  const rack = ed.selected;
  const [elementId, setElementId] = useState<string>();
  const items = lib.racks.all().map(({ item, source }) => ({
    id: item.id,
    name: item.name,
    path: [RACK_KINDS[item.kind] ?? item.kind],
    keywords: item.kind,
    badge: `${item.units}${item.unitSystem}${source === 'project' ? ' *' : ''}`,
  }));
  return (
    <ModuleLayout
      sidebar={<Sidebar title="Rack templates" items={items} selectedId={ed.selectedId} onSelect={(id) => { ed.select(id); setElementId(undefined); }}
        onNew={() => ed.create('new-rack', newRack)} onDuplicate={ed.duplicate} onDelete={ed.del} />}
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
