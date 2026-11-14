import type { Library } from '../../domain/library/Library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { withSetting } from '../../domain/device/portSettings';
import { resolvePlacedPort } from '../../domain/design/optics';
import { PortSettingFields } from '../../ui/PortSettingFields';

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
  const inh = resolvePlacedPort(device, { ...placement, portSettings: {} }, portRef);
  const eff = resolvePlacedPort(device, placement, portRef);
  return (
    <div className="card">
      <strong>{`Port ${portRef} (${group.connector})`}</strong>
      <PortSettingFields lib={lib} group={group} value={placement.portSettings[portRef] ?? {}}
        inherited={{ mode: inh?.mode, optic: lib.optics.get(inh?.opticId)?.name, cable: lib.cableMedia.get(inh?.cableId)?.name }}
        onChange={(s) => onChange((p) => ({ ...p, portSettings: withSetting(p.portSettings, portRef, s) }))} />
      <p className="muted">{`Effective: ${eff?.mode ?? ''} · ${lib.optics.get(eff?.opticId)?.name ?? 'no optic'} · ${lib.cableMedia.get(eff?.cableId)?.name ?? 'no cable'}`}</p>
    </div>
  );
}
