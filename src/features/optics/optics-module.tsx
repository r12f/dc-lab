import { useState } from 'react';
import { useLibrary } from '../../state/use-library';
import { useAppStore } from '../../state/store';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar, type SidebarItem } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { cableTreePlacement, opticTreePlacement } from '../../domain/optics/grouping';
import { fromKey, toKey } from './catalog-ref';
import { useOpticsCatalog } from './use-optics-catalog';
import { NewOpticsMenu } from './new-optics-menu';
import { OpticDrawing } from './optic-drawing';
import { CableDrawing } from './cable-drawing';
import { OpticInspector } from './optic-inspector';
import { CableInspector } from './cable-inspector';
import { useItemVariants } from '../items/use-item-variants';
import { fromItemKey, toItemKey } from '../items/item-key';
import { variantChildren, variantKeywords } from '../items/variant-children';
import { ItemVariantEditor } from '../items/item-variant-editor';
import { ItemsSection } from '../items/items-section';

export function OpticsModule() {
  const lib = useLibrary();
  const cat = useOpticsCatalog(lib);
  const hiddenCount = useAppStore((s) => s.project.hiddenBuiltins.length);
  const restoreBuiltins = useAppStore((s) => s.restoreBuiltins);
  const [menuOpen, setMenuOpen] = useState(false);
  const mark = (src: string) => (src === 'project' ? ' *' : '');

  const variants = useItemVariants(lib);
  // Type (optic family / cable type) -> item type -> items.
  const items: SidebarItem[] = [
    ...lib.optics.all().map(({ item, source }) => {
      const place = opticTreePlacement(item);
      return {
        id: toKey({ catalog: 'optic', id: item.id }), name: item.name, ...place,
        keywords: `${item.reach} ${item.packaging} ${item.fiberConnector} ${variantKeywords(lib, item.id)}`,
        badge: `${item.formFactor}${item.packaging === 'pigtail' ? ' pigtail' : ''}${mark(source)}`,
        children: variantChildren(lib, item.id, place.path),
      };
    }),
    ...lib.cableMedia.all().map(({ item, source }) => {
      const place = cableTreePlacement(item);
      const path = place.path;
      return {
        id: toKey({ catalog: 'cable', id: item.id }), name: item.name, ...place,
        keywords: `${item.ends.a.connector} ${item.ends.b.connector} ${item.type} ${item.mapping} ${variantKeywords(lib, item.id)}`,
        // The name already says the ends; only the project marker is shown.
        badge: mark(source).trim() || undefined,
        children: variantChildren(lib, item.id, path),
      };
    }),
  ];
  // Selection is an item type key or an item key; an item shows its item type below the item editor.
  const selKey = useAppStore((s) => s.selected.optics);
  const variant = lib.variants.get(fromItemKey(selKey));
  const ref = variant ? { catalog: variant.target === 'cable' ? 'cable' as const : 'optic' as const, id: variant.itemId } : cat.ref;
  const optic = ref?.catalog === 'optic' ? lib.optics.get(ref.id) : undefined;
  const cable = ref?.catalog === 'cable' ? lib.cableMedia.get(ref.id) : undefined;
  const typeReadOnly = !!ref && (ref.catalog === 'optic' ? lib.optics : lib.cableMedia).sourceOf(ref.id) === 'builtin';
  const selectKey = useAppStore((s) => s.select);
  const chooseItem = (id: string) => selectKey('optics', toItemKey(id));
  const withRef = (key: string, f: (r: NonNullable<typeof ref>) => void) => { const r = fromKey(key); if (r) f(r); };
  const header = ref && (variant
    ? <ItemVariantEditor lib={lib} variant={variant} itemTypeName={(optic ?? cable)?.name ?? ''} commands={variants}
        readOnly={variants.isReadOnly(variant, typeReadOnly)} />
    : <ItemsSection lib={lib} target={ref.catalog} itemId={ref.id} commands={variants} onSelect={chooseItem} />);

  return (
    <ModuleLayout
      sidebar={
        <Sidebar title="Optics & Cables" items={items} filterable selectedId={selKey}
          onSelect={(k) => (fromItemKey(k) ? selectKey('optics', k) : cat.choose(fromKey(k)))}
          onNew={() => setMenuOpen((o) => !o)}
          onDuplicate={(k) => (variant ? chooseItem(variants.duplicate(variant)) : withRef(k, cat.duplicate))}
          onDelete={(k) => { if (variant) { variants.del(variant); cat.choose(ref); } else withRef(k, cat.del); }}
          header={menuOpen && <NewOpticsMenu onClose={() => setMenuOpen(false)} onPick={(c) => cat.create(c.catalog, c.baseId, c.build)} />}
          footer={hiddenCount > 0 && (
            <button type="button" className="link" onClick={restoreBuiltins}>{`Show ${hiddenCount} hidden built-in item(s)`}</button>
          )}
        />
      }
      canvas={
        optic ? (
          <CanvasFrame title={optic.name} exportName={optic.id}>{(r) => <OpticDrawing ref={r} optic={optic} />}</CanvasFrame>
        ) : cable ? (
          <CanvasFrame title={cable.name} exportName={cable.id}>{(r) => <CableDrawing ref={r} cable={cable} />}</CanvasFrame>
        ) : <EmptyCanvas text="Select or create an optic or cable." />
      }
      inspector={
        optic ? (
          <OpticInspector optic={optic} header={header} readOnly={typeReadOnly} onChange={(o) => cat.save('optic', o)}
            onDuplicate={() => cat.duplicate({ catalog: 'optic', id: optic.id })} />
        ) : cable ? (
          <CableInspector cable={cable} header={header} readOnly={typeReadOnly} onChange={(c) => cat.save('cable', c)}
            onDuplicate={() => cat.duplicate({ catalog: 'cable', id: cable.id })} />
        ) : undefined
      }
    />
  );
}
