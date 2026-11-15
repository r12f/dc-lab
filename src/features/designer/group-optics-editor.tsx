import { groupConnector } from '../../domain/device/port-label';
import type { Library } from '../../domain/library/library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import { withSetting } from '../../domain/device/port-settings';
import { resolvePlacedPort } from '../../domain/design/optics';
import { ROLE_TRAITS } from '../../domain/device/roles';
import { Section } from '../../ui/fields';
import { PortSettingFields } from '../../ui/port-setting-fields';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  placement: Placement;
  onChange(fn: (p: Placement) => Placement): void;
}

/** Instance-level setting per port group (overrides the profile for every port of the group). */
export function GroupOpticsEditor({ lib, device, placement, onChange }: Props) {
  const groups = device.ports.filter((g) => ROLE_TRAITS[g.role].pluggable || g.role === 'laser');
  if (groups.length === 0) return null;
  const noPorts = { ...placement, portSettings: {} };
  return (
    <Section title="Port groups (this instance)">
      {groups.map((g) => (
        <details key={g.id} className="card">
          <summary>{`${g.label} (${g.count}x ${groupConnector(g)}${g.opticalEngine ? ` ${g.opticalEngine.toUpperCase()}` : ''})`}</summary>
          <PortSettingFields lib={lib} group={g} value={placement.groupSettings[g.id] ?? {}}
            inherited={resolvePlacedPort(lib, device, { ...noPorts, groupSettings: {} }, `${g.id}/1`)}
            effective={resolvePlacedPort(lib, device, noPorts, `${g.id}/1`)}
            onChange={(s) => onChange((p) => ({ ...p, groupSettings: withSetting(p.groupSettings, g.id, s) }))} />
        </details>
      ))}
    </Section>
  );
}
