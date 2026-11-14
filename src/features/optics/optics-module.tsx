import { useState } from 'react';
import { useLibrary } from '../../state/use-library';
import { useAppStore } from '../../state/store';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar, type SidebarItem } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { CABLE_TYPES } from '../../domain/optics/cable-types';
import { fromKey, toKey } from './catalog-ref';
import { useOpticsCatalog } from './use-optics-catalog';
import { NewOpticsMenu } from './new-optics-menu';
import { OpticDrawing } from './optic-drawing';
import { CableDrawing } from './cable-drawing';
import { OpticInspector } from './optic-inspector';
import { CableInspector } from './cable-inspector';

export function OpticsModule() {
  const lib = useLibrary();
  const cat = useOpticsCatalog(lib);
  const hiddenCount = useAppStore((s) => s.project.hiddenBuiltins.length);
  const restoreBuiltins = useAppStore((s) => s.restoreBuiltins);
  const [menuOpen, setMenuOpen] = useState(false);
  const mark = (src: string) => (src === 'project' ? ' *' : '');

  const items: SidebarItem[] = [
    ...lib.optics.all().map(({ item, source }) => ({
      id: toKey({ catalog: 'optic', id: item.id }), name: item.name,
      path: ['Optics', item.formFactor || 'Other'],
      keywords: `${item.vendor} ${item.model ?? ''} ${item.reach} ${item.packaging} ${item.fiberConnector}`,
      badge: `${item.packaging === 'pigtail' ? 'pigtail' : `${item.speedGbps}G`}${mark(source)}`,
    })),
    ...lib.cableMedia.all().map(({ item, source }) => ({
      id: toKey({ catalog: 'cable', id: item.id }), name: item.name,
      path: ['Cables', CABLE_TYPES[item.type] ?? item.type],
      keywords: `${item.vendor ?? ''} ${item.model ?? ''} ${item.connector} ${item.type}`,
      badge: `${item.connector}${mark(source)}`,
    })),
  ];
  const ref = cat.ref;
  const optic = ref?.catalog === 'optic' ? lib.optics.get(ref.id) : undefined;
  const cable = ref?.catalog === 'cable' ? lib.cableMedia.get(ref.id) : undefined;
  const withRef = (key: string, f: (r: NonNullable<typeof ref>) => void) => { const r = fromKey(key); if (r) f(r); };

  return (
    <ModuleLayout
      sidebar={
        <Sidebar title="Optics & Cables" items={items} filterable selectedId={ref && toKey(ref)}
          onSelect={(k) => cat.choose(fromKey(k))}
          onNew={() => setMenuOpen((o) => !o)}
          onDuplicate={(k) => withRef(k, cat.duplicate)}
          onDelete={(k) => withRef(k, cat.del)}
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
          <OpticInspector optic={optic} readOnly={cat.readOnly} onChange={(o) => cat.save('optic', o)}
            onDuplicate={() => cat.duplicate({ catalog: 'optic', id: optic.id })} />
        ) : cable ? (
          <CableInspector cable={cable} readOnly={cat.readOnly} onChange={(c) => cat.save('cable', c)}
            onDuplicate={() => cat.duplicate({ catalog: 'cable', id: cable.id })} />
        ) : undefined
      }
    />
  );
}
