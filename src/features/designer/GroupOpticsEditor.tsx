import type { Library } from '../../domain/library/Library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import { findProfile } from '../../domain/device/breakout';
import { resolvePort, withSetting } from '../../domain/device/portSettings';
import { ROLE_TRAITS } from '../../domain/device/roles';
import { Section } from '../../ui/fields';
import { PortSettingFields } from '../../ui/PortSettingFields';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  placement: Placement;
  onChange(fn: (p: Placement) => Placement): void;
}

/** Instance-level setting per port group (overrides the profile for every port of the group). */
export function GroupOpticsEditor({ lib, device, placement, onChange }: Props) {
  const profile = findProfile(device, placement.breakoutProfileId);
  const groups = device.ports.filter((g) => ROLE_TRAITS[g.role].pluggable);
  if (groups.length === 0) return null;
  return (
    <Section title="Port groups (this instance)">
      {groups.map((g) => {
        const inh = resolvePort(device, `${g.id}/1`, profile && { ...profile, overrides: {} });
        return (
          <details key={g.id} className="card">
            <summary>{`${g.label} (${g.count}x ${g.connector})`}</summary>
            <PortSettingFields lib={lib} group={g} value={placement.groupSettings[g.id] ?? {}}
              inherited={{ mode: inh?.mode, optic: lib.optics.get(inh?.opticId)?.name, cable: lib.cableMedia.get(inh?.cableId)?.name }}
              onChange={(s) => onChange((p) => ({ ...p, groupSettings: withSetting(p.groupSettings, g.id, s) }))} />
          </details>
        );
      })}
    </Section>
  );
}
