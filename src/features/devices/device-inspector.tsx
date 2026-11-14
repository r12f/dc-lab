import { useState, type ReactNode } from 'react';
import { Tabs } from '../../ui/tabs';
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
  /** Item editor or item list, shown in the Items tab. */
  header?: ReactNode;
  itemCount?: number;
  /** An item (not the item type) is selected: the Items tab is shown. */
  itemSelected?: boolean;
  /** Back to the item type (deselects the item). */
  onLeaveItem?(): void;
  /** Built-in device: saves profile edits to the project. */
  onProfilesChange?(device: DeviceDefinition): void;
  onResetProfiles?(): void;
}

export function DeviceInspector(props: Props) {
  const [tab, setTab] = useState<'type' | 'items'>('type');
  // Opening an item (from the sidebar or the list) shows the Items tab.
  const showItems = tab === 'items' || props.itemSelected;
  return (
    <div className="inspector-inner">
      <Tabs<'type' | 'items'> tabs={[{ id: 'type', label: 'Item type' }, { id: 'items', label: `Items (${props.itemCount ?? 0})` }]}
        value={showItems ? 'items' : 'type'} onChange={(t) => { setTab(t); if (t === 'type') props.onLeaveItem?.(); }} />
      {showItems ? props.header : <ItemTypeBody {...props} />}
    </div>
  );
}

function ItemTypeBody(props: Props) {
  const { device, readOnly, onChange, onDuplicate } = props;
  return (
    <>
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
    </>
  );
}
