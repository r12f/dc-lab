import { useState } from 'react';
import { useLibrary } from '../../state/use-library';
import { useCatalogEditor } from '../../state/use-catalog-editor';
import { newRack, RACK_KINDS } from '../../domain/rack/types';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { RackTemplateDrawing } from './rack-template-drawing';
import { RackInspector } from './rack-inspector';
import { useAppStore } from '../../state/store';
import { useItemVariants } from '../items/use-item-variants';
import { fromItemKey, toItemKey } from '../items/item-key';
import { variantChildren, variantKeywords } from '../items/variant-children';
import { ItemVariantEditor } from '../items/item-variant-editor';
import { ItemsSection } from '../items/items-section';
import { ItemTabs } from '../items/item-tabs';


export function RacksModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('racks', 'racks', lib.racks);
  const variants = useItemVariants(lib);
  const selKey = useAppStore((s) => s.selected.racks);
  const select = useAppStore((s) => s.select);
  // Selection is a rack template id or an item key (an item of a template: vendor / PN, its own properties).
  const variant = lib.variants.get(fromItemKey(selKey));
  const rack = variant ? lib.racks.get(variant.itemId) : ed.selected;
  const typeReadOnly = !!rack && lib.racks.sourceOf(rack.id) === 'builtin';
  const [elementId, setElementId] = useState<string>();
  const items = lib.racks.all().map(({ item, source }) => ({
    id: item.id,
    name: item.name,
    path: [RACK_KINDS[item.kind] ?? item.kind],
    keywords: `${item.kind} ${item.units}${item.unitSystem} ${item.widthMm}mm ${item.sideElements.map((e) => e.name).join(' ')}`,
    badge: `${item.units}${item.unitSystem}${source === 'project' ? ' *' : ''}`,
    keywordsItems: variantKeywords(lib, item.id),
    children: variantChildren(lib, item.id, [RACK_KINDS[item.kind] ?? item.kind]),
  })).map(({ keywordsItems, ...i }) => ({ ...i, keywords: `${i.keywords} ${keywordsItems}` }));
  const chooseItem = (id: string) => select('racks', toItemKey(id));
  const items_ = rack && (variant
    ? <>
        <button type="button" className="link" onClick={() => ed.select(rack.id)}>← All items</button>
        <ItemVariantEditor lib={lib} variant={variant} itemTypeName={rack.name} commands={variants}
          onDeleted={() => ed.select(rack.id)} readOnly={variants.isReadOnly(variant, typeReadOnly)} />
      </>
    : <ItemsSection lib={lib} target="rack" itemId={rack.id} commands={variants} onSelect={chooseItem} />);
  return (
    <ModuleLayout
      sidebar={<Sidebar title="Rack templates" items={items} filterable selectedId={selKey} onSelect={(id) => { if (fromItemKey(id)) select('racks', id); else ed.select(id); setElementId(undefined); }}
        onNew={() => ed.create('new-rack', newRack)}
        onDuplicate={(id) => (variant ? chooseItem(variants.duplicate(variant)) : ed.duplicate(id))}
        onDelete={(id) => { if (variant && rack) { variants.del(variant); ed.select(rack.id); } else ed.del(id); }}
        canDelete={(id) => (variant ? variants.canDelete(variant) : ed.canDelete(id))} />}
      canvas={rack ? (
        <CanvasFrame title={rack.name} exportName={rack.id}>
          {(ref) => <RackTemplateDrawing ref={ref} rack={rack} selectedElementId={elementId} onElementClick={setElementId} />}
        </CanvasFrame>
      ) : <EmptyCanvas text="Select or create a rack template." />}
      inspector={rack && (
        <ItemTabs key={rack.id} items={items_} itemCount={lib.variants.of(rack.id).length} itemSelected={!!variant}
          onLeaveItem={() => variant && ed.select(rack.id)}>
          <RackInspector rack={rack} readOnly={typeReadOnly} onChange={ed.save}
            onDuplicate={() => ed.duplicate(rack.id)}
            selectedElementId={elementId} onSelectElement={setElementId} />
        </ItemTabs>
      )}
    />
  );
}
