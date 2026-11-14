import { deviceSortKey } from '../../domain/device/ports';
import { useState } from 'react';
import { useLibrary } from '../../state/use-library';
import { useCatalogEditor } from '../../state/use-catalog-editor';
import { useAppStore } from '../../state/store';
import { categoryFolder } from '../../domain/device/categories';
import { findProfile } from '../../domain/device/breakout';
import { resolvePort } from '../../domain/device/port-settings';
import { formatHeight } from '../../domain/units';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { DeviceDrawing } from './drawing/device-drawing';
import { DeviceInspector } from './device-inspector';
import { NewDeviceMenu } from './new-device-menu';
import { usePortSelection } from './use-port-selection';
import { useItemVariants } from '../items/use-item-variants';
import { fromItemKey, toItemKey } from '../items/item-key';
import { variantChildren, variantKeywords } from '../items/variant-children';
import { ItemVariantEditor } from '../items/item-variant-editor';
import { ItemsSection } from '../items/items-section';

export function DevicesModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('devices', 'devices', lib.devices);
  const hiddenCount = useAppStore((s) => s.project.hiddenBuiltins.length);
  const restoreBuiltins = useAppStore((s) => s.restoreBuiltins);
  const setBuiltinProfiles = useAppStore((s) => s.setBuiltinProfiles);
  const builtinProfiles = useAppStore((s) => s.project.builtinProfiles);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileId, setProfileId] = useState<string>();
  const ports = usePortSelection();
  const variants = useItemVariants(lib);
  // Selection is an item type id or an item key; an item selects its item type for drawing/editing.
  const variantId = fromItemKey(ed.selectedId);
  const variant = lib.variants.get(variantId);
  const device = variant ? lib.devices.get(variant.itemId) : ed.selected;
  const typeReadOnly = !!device && lib.devices.sourceOf(device.id) === 'builtin';
  const profile = device && findProfile(device, profileId);

  // Type (category) -> item type -> items.
  const items = lib.devices.all().map(({ item, source }) => {
    const path = [categoryFolder(item.category)];
    return {
      id: item.id,
      name: item.name,
      path,
      order: deviceSortKey(item),
      keywords: `${item.category} ${variantKeywords(lib, item.id)}`,
      badge: `${formatHeight(item.height)}${source === 'project' ? ' *' : ''}`,
      children: variantChildren(lib, item.id, path),
    };
  });
  const select = (key: string | undefined) => { ed.select(key); ports.clear(); setProfileId(undefined); };
  const duplicateSel = (key: string) => {
    if (variant) select(toItemKey(variants.duplicate(variant)));
    else ed.duplicate(key);
  };
  const deleteSel = (key: string) => {
    if (variant) { variants.del(variant); select(device?.id); } else ed.del(key);
  };

  return (
    <ModuleLayout
      sidebar={
        <Sidebar
          title="Devices"
          items={items}
          filterable
          selectedId={ed.selectedId}
          onSelect={select}
          onNew={() => setMenuOpen((o) => !o)}
          onDuplicate={duplicateSel}
          onDelete={deleteSel}
          header={menuOpen && (
            <NewDeviceMenu onClose={() => setMenuOpen(false)} onPick={(t) => ed.create(`new-${t.id}`, t.build)} />
          )}
          footer={hiddenCount > 0 && (
            <button type="button" className="link" onClick={restoreBuiltins}>{`Show ${hiddenCount} hidden built-in item(s)`}</button>
          )}
        />
      }
      canvas={
        device ? (
          <CanvasFrame title={device.name} exportName={device.id}
            toolbar={<span className="muted">Click a port; Ctrl/Shift-click to multi-select</span>}>
            {(ref) => (
              <DeviceDrawing ref={ref} device={device} ctx={{
                lib,
                resolve: (r) => resolvePort(lib, device, r, profile),
                selectedPorts: ports.selected,
                onPortClick: ports.click,
              }} />
            )}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a device." />
        )
      }
      inspector={
        device && (
          <DeviceInspector
            lib={lib}
            device={device}
            header={variant
              ? <>
                  <button type="button" className="link" onClick={() => select(device.id)}>← All items</button>
                  <ItemVariantEditor lib={lib} variant={variant} itemTypeName={device.name} commands={variants}
                    onDeleted={() => select(device.id)}
                    readOnly={variants.isReadOnly(variant, typeReadOnly)} />
                </>
              : <ItemsSection lib={lib} target="device" itemId={device.id} commands={variants}
                  onSelect={(id) => select(toItemKey(id))} />}
            itemCount={lib.variants.of(device.id).length}
            itemSelected={!!variant}
            onLeaveItem={() => variant && select(device.id)}
            readOnly={typeReadOnly}
            onChange={ed.save}
            onProfilesChange={typeReadOnly ? (d) => setBuiltinProfiles(d.id, { breakoutProfiles: d.breakoutProfiles, defaultProfileId: d.defaultProfileId }) : undefined}
            onResetProfiles={typeReadOnly && builtinProfiles[device.id] ? () => setBuiltinProfiles(device.id, undefined) : undefined}
            onDuplicate={() => ed.duplicate(device.id)}
            profileId={profileId}
            onProfileChange={setProfileId}
            selectedPorts={ports.selected}
            onSelectPorts={ports.set}
          />
        )
      }
    />
  );
}
