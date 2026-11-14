import type { Library } from '../../domain/library/library';
import type { CableEndpoint, RackDesign } from '../../domain/design/types';
import { allPortRefs } from '../../domain/device/ports';
import { endpointLegs } from '../../domain/design/connectors';
import { SelectField } from '../../ui/fields';

interface Props {
  lib: Library;
  design: RackDesign;
  label: string;
  value: CableEndpoint;
  onChange(v: CableEndpoint): void;
}

/** Device + port + connector (leg) of one cable end. */
export function EndpointEditor({ lib, design, label, value, onChange }: Props) {
  const placement = design.placements.find((p) => p.id === value.placementId);
  const device = placement && lib.devices.get(placement.deviceId);
  const ports = device ? allPortRefs(device) : [];
  const legs = endpointLegs(lib, design, value.placementId, value.portRef);
  const legOptions = legs
    ? Array.from({ length: legs.count }, (_, i) => ({ value: String(i + 1), label: `${i + 1} · ${legs.connector}` }))
    : [];
  return (
    <div className="row3">
      <SelectField label={`${label} device`} value={value.placementId}
        options={design.placements.map((p) => ({ value: p.id, label: `${p.label} · ${lib.devices.get(p.deviceId)?.name ?? ''}` }))}
        onChange={(placementId) => onChange({ placementId, portRef: '' })} />
      <SelectField label="Port" value={value.portRef}
        options={[{ value: '', label: 'any' }, ...ports.map((r) => ({ value: r, label: r }))]}
        onChange={(portRef) => {
          const n = endpointLegs(lib, design, value.placementId, portRef);
          onChange({ ...value, portRef, connector: n ? 1 : undefined });
        }} />
      <SelectField label="Connector" value={value.connector ? String(value.connector) : ''}
        options={legOptions.length ? legOptions : [{ value: '', label: legs === undefined && value.portRef ? 'none' : '—' }]}
        disabled={!legOptions.length}
        onChange={(v) => onChange({ ...value, connector: Number(v) || undefined })} />
    </div>
  );
}
