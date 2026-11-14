import type { Library } from '../../domain/library/library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { withSetting } from '../../domain/device/port-settings';
import { resolvePlacedPort } from '../../domain/design/optics';
import { PortSettingFields } from '../../ui/port-setting-fields';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  placement: Placement;
  portRef: string;
  onChange(fn: (p: Placement) => Placement): void;
}

/** Instance-level setting for one port. */
export function PortConfigEditor({ lib, device, placement, portRef, onChange }: Props) {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return null;
  const inh = resolvePlacedPort(lib, device, { ...placement, portSettings: {} }, portRef);
  const eff = resolvePlacedPort(lib, device, placement, portRef);
  return (
    <div className="card">
      <strong>{`Port ${portRef} (${group.formFactor})`}</strong>
      <PortSettingFields lib={lib} group={group} value={placement.portSettings[portRef] ?? {}} inherited={inh} effective={eff}
        onChange={(s) => onChange((p) => ({ ...p, portSettings: withSetting(p.portSettings, portRef, s) }))} />
      <p className="muted">{`Effective: ${eff?.mode ?? ''} · ${eff?.reach ?? 'no reach'} · ${eff?.optic?.name ?? 'no module'} · ${lib.cableMedia.get(eff?.cableId)?.name ?? 'no cable'}`}</p>
    </div>
  );
}
