import type { ReactNode } from 'react';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Library } from '../../domain/library/library';
import { validateDevice } from '../../domain/device/validate';
import { ReadOnlyNotice } from '../../ui/read-only-notice';
import { WarningList } from '../../ui/stat-grid';
import { Button } from '../../ui/button';
import { downloadText } from '../../io/download';
import { DeviceGeneralForm } from './device-general-form';
import { PowerInputForm } from './power-input-form';
import { PortGroupsEditor } from './port-groups-editor';
import { BreakoutProfilesEditor } from './breakout-profiles-editor';

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
  /** Item editor or item list, shown above the item type editor. */
  header?: ReactNode;
}

export function DeviceInspector(props: Props) {
  const { device, readOnly, onChange, onDuplicate } = props;
  return (
    <div className="inspector-inner">
      {props.header}
      <h3 className="inspector-subtitle">Item type</h3>
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <WarningList warnings={validateDevice(device)} />
      <fieldset disabled={readOnly} className="plain">
        <DeviceGeneralForm device={device} onChange={onChange} />
      </fieldset>
      <fieldset disabled={readOnly} className="plain">
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
