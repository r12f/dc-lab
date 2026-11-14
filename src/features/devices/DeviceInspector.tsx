import type { DeviceDefinition } from '../../domain/device/types';
import { validateDevice } from '../../domain/device/validate';
import { ReadOnlyNotice } from '../../ui/ReadOnlyNotice';
import { WarningList } from '../../ui/StatGrid';
import { DeviceGeneralForm } from './DeviceGeneralForm';
import { PortGroupsEditor } from './PortGroupsEditor';
import { BreakoutProfilesEditor } from './BreakoutProfilesEditor';
import { Button } from '../../ui/Button';
import { downloadText } from '../../io/download';

interface Props {
  device: DeviceDefinition;
  readOnly: boolean;
  onChange(device: DeviceDefinition): void;
  onDuplicate(): void;
  profileId?: string;
  onProfileChange(id: string | undefined): void;
  selectedPort?: string;
}

export function DeviceInspector({ device, readOnly, onChange, onDuplicate, profileId, onProfileChange, selectedPort }: Props) {
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <WarningList warnings={validateDevice(device)} />
      <fieldset disabled={readOnly} className="plain">
        <DeviceGeneralForm device={device} onChange={onChange} />
        <PortGroupsEditor device={device} onChange={onChange} />
      </fieldset>
      <BreakoutProfilesEditor
        device={device}
        readOnly={readOnly}
        onChange={onChange}
        profileId={profileId}
        onProfileChange={onProfileChange}
        selectedPort={selectedPort}
      />
      <Button onClick={() => downloadText(`${device.id}.json`, JSON.stringify({ schema: 'dc-lab/device@1', ...device }, null, 2))}>
        Export device JSON
      </Button>
    </div>
  );
}
