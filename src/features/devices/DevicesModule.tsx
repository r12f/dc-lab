import { useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useCatalogEditor } from '../../state/useCatalogEditor';
import { newDevice } from '../../domain/device/factory';
import { traitsOf } from '../../domain/device/categories';
import { formatHeight } from '../../domain/units';
import { ModuleLayout } from '../../ui/ModuleLayout';
import { Sidebar } from '../../ui/Sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/CanvasFrame';
import { DeviceFaceplate } from './DeviceFaceplate';
import { DeviceInspector } from './DeviceInspector';

export function DevicesModule() {
  const lib = useLibrary();
  const ed = useCatalogEditor('devices', 'devices', lib.devices, newDevice);
  const [profileId, setProfileId] = useState<string>();
  const [selectedPort, setSelectedPort] = useState<string>();
  const device = ed.selected;
  const profile = device?.breakoutProfiles.find((p) => p.id === profileId);

  const items = lib.devices.all().map(({ item, source }) => ({
    id: item.id,
    name: item.name,
    group: traitsOf(item.category).label,
    badge: source === 'builtin' ? formatHeight(item.height) : `${formatHeight(item.height)} *`,
    readOnly: source === 'builtin',
  }));

  return (
    <ModuleLayout
      sidebar={
        <Sidebar
          title="Devices"
          items={items}
          selectedId={ed.selectedId}
          onSelect={(id) => { ed.select(id); setSelectedPort(undefined); setProfileId(undefined); }}
          onNew={ed.create}
          onDuplicate={ed.duplicate}
          onDelete={ed.del}
        />
      }
      canvas={
        device ? (
          <CanvasFrame title={device.name} exportName={device.id}>
            {(ref) => (
              <DeviceFaceplate
                ref={ref}
                device={device}
                profile={profile}
                selectedPort={selectedPort}
                onSelectPort={setSelectedPort}
              />
            )}
          </CanvasFrame>
        ) : (
          <EmptyCanvas text="Select or create a device." />
        )
      }
      inspector={
        device && (
          <DeviceInspector
            device={device}
            readOnly={ed.readOnly}
            onChange={ed.save}
            onDuplicate={() => ed.duplicate(device.id)}
            profileId={profileId}
            onProfileChange={setProfileId}
            selectedPort={selectedPort}
          />
        )
      }
    />
  );
}
