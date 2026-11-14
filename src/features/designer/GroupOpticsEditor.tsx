import type { Library } from '../../domain/library/Library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import { Section, SelectField } from '../../ui/fields';
import { opticOptions } from './opticOptions';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  placement: Placement;
  onChange(fn: (p: Placement) => Placement): void;
}

/** Default optic per port group (applies to every port without an explicit optic). */
export function GroupOpticsEditor({ lib, device, placement, onChange }: Props) {
  const groups = device.ports.filter((g) => opticOptions(lib, g.connector).length > 1);
  if (groups.length === 0) return null;
  const set = (groupId: string, opticId: string) =>
    onChange((p) => {
      const groupOptics = { ...p.groupOptics };
      if (opticId) groupOptics[groupId] = opticId;
      else delete groupOptics[groupId];
      return { ...p, groupOptics };
    });
  return (
    <Section title="Optics by port group">
      {groups.map((g) => (
        <SelectField key={g.id} label={`${g.label} (${g.count}x ${g.connector})`}
          value={placement.groupOptics[g.id] ?? ''} options={opticOptions(lib, g.connector)}
          onChange={(v) => set(g.id, v)} />
      ))}
    </Section>
  );
}
