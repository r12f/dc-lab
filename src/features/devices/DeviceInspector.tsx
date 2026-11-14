import type { DeviceDefinition } from '../../domain/device/types';
import type { Library } from '../../domain/library/Library';
import { validateDevice } from '../../domain/device/validate';
import { ReadOnlyNotice } from '../../ui/ReadOnlyNotice';
import { WarningList } from '../../ui/StatGrid';
import { Button } from '../../ui/Button';
import { downloadText } from '../../io/download';
import { DeviceGeneralForm } from './DeviceGeneralForm';
import { PowerInputForm } from './PowerInputForm';
import { PortGroupsEditor } from './PortGroupsEditor';
import { BreakoutProfilesEditor } from './BreakoutProfilesEditor';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  readOnly: boolean;
  onChange(device: DeviceDefinition): void;
  onDuplicate(): void;
  profileId?: string;
  onProfileChange(id: string | undefined): void;
  selectedPorts: ReadonlySet<string>;
  onSelectPorts(refs: string[]): void;
}

export function DeviceInspector(props: Props) {
  const { device, readOnly, onChange, onDuplicate } = props;
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <WarningList warnings={validateDevice(device)} />
      <fieldset disabled={readOnly} className="plain">
        <DeviceGeneralForm device={device} onChange={onChange} />
        <PowerInputForm device={device} onChange={onChange} />
        <PortGroupsEditor device={device} onChange={onChange} />
      </fieldset>
      <BreakoutProfilesEditor {...props} />
      <Button onClick={() => downloadText(`${device.id}.json`, JSON.stringify({ schema: 'dc-lab/device@1', ...device }, null, 2))}>
        Export device JSON
      </Button>
    </div>
  );
}
