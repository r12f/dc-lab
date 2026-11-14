import { useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useCatalogEditor } from '../../state/useCatalogEditor';
import { useAppStore } from '../../state/store';
import { traitsOf } from '../../domain/device/categories';
import { findProfile } from '../../domain/device/breakout';
import { resolvePort } from '../../domain/device/portSettings';
import { formatHeight } from '../../domain/units';
import { ModuleLayout } from '../../ui/ModuleLayout';
import { Sidebar } from '../../ui/Sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/CanvasFrame';
import { DeviceDrawing } from './drawing/DeviceDrawing';
import { DeviceInspector } from './DeviceInspector';
import { NewDeviceMenu } from './NewDeviceMenu';
import { usePortSelection } from './usePortSelection';

export function DevicesModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('devices', 'devices', lib.devices);
  const hiddenCount = useAppStore((s) => s.project.hiddenBuiltins.length);
  const restoreBuiltins = useAppStore((s) => s.restoreBuiltins);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileId, setProfileId] = useState<string>();
  const ports = usePortSelection();
  const device = ed.selected;
  const profile = device && findProfile(device, profileId);

  const items = lib.devices.all().map(({ item, source }) => ({
    id: item.id,
    name: item.name,
    path: [item.vendor || 'Unknown vendor', traitsOf(item.category).label],
    keywords: `${item.model} ${item.category}`,
    badge: `${formatHeight(item.height)}${source === 'project' ? ' *' : ''}`,
  }));

  return (
    <ModuleLayout
      sidebar={
        <Sidebar
          title="Devices"
          items={items}
          filterable
          selectedId={ed.selectedId}
          onSelect={(id) => { ed.select(id); ports.clear(); setProfileId(undefined); }}
          onNew={() => setMenuOpen((o) => !o)}
          onDuplicate={ed.duplicate}
          onDelete={ed.del}
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
            readOnly={ed.readOnly}
            onChange={ed.save}
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
