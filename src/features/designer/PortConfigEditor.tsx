import type { Library } from '../../domain/library/Library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { PortConfig, Placement } from '../../domain/design/types';
import { effectiveMode, findProfile, modesOf } from '../../domain/device/breakout';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { opticOnPort } from '../../domain/design/optics';
import { SelectField } from '../../ui/fields';
import { opticOptions } from './opticOptions';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  placement: Placement;
  portRef: string;
  onChange(fn: (p: Placement) => Placement): void;
}

const INHERIT = '__inherit';

function patchPort(p: Placement, portRef: string, patch: Partial<PortConfig>): Placement {
  const merged: PortConfig = { ...p.portConfig[portRef], ...patch };
  const portConfig = { ...p.portConfig };
  const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as PortConfig;
  if (Object.keys(cleaned).length === 0) delete portConfig[portRef];
  else portConfig[portRef] = cleaned;
  return { ...p, portConfig };
}

/** Instance-level breakout and optic override for one port. */
export function PortConfigEditor({ lib, device, placement, portRef, onChange }: Props) {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return null;
  const cfg = placement.portConfig[portRef] ?? {};
  const profile = findProfile(device, placement.breakoutProfileId);
  const inheritedMode = effectiveMode(device, portRef, profile);
  const inheritedOptic = placement.groupOptics[group.id];
  return (
    <div className="card">
      <strong>{`Port ${portRef} (${group.connector})`}</strong>
      <SelectField
        label="Breakout"
        value={cfg.breakout ?? INHERIT}
        options={[{ value: INHERIT, label: `inherit (${inheritedMode})` }, ...modesOf(group).map((m) => ({ value: m, label: m }))]}
        onChange={(v) => onChange((p) => patchPort(p, portRef, { breakout: v === INHERIT ? undefined : v }))}
      />
      <SelectField
        label="Optic"
        value={cfg.opticId === undefined ? INHERIT : cfg.opticId}
        options={[
          { value: INHERIT, label: `inherit (${lib.optics.get(inheritedOptic)?.name ?? 'none'})` },
          ...opticOptions(lib, group.connector, 'none (empty cage)'),
        ]}
        onChange={(v) => onChange((p) => patchPort(p, portRef, { opticId: v === INHERIT ? undefined : v }))}
      />
      <p className="muted">{`Effective: ${effectiveMode(device, portRef, profile, cfg.breakout)} · ${lib.optics.get(opticOnPort(placement, portRef))?.name ?? 'no optic'}`}</p>
    </div>
  );
}
