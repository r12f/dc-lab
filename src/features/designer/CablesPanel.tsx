import type { Library } from '../../domain/library/Library';
import type { CableEndpoint, CableRun, RackDesign } from '../../domain/design/types';
import { allPortRefs } from '../../domain/device/ports';
import { Button } from '../../ui/Button';
import { NumberField, Section, SelectField } from '../../ui/fields';
import type { DesignEditor } from './useDesignEditor';

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
}

function EndpointEditor({ lib, design, label, value, onChange }: {
  lib: Library; design: RackDesign; label: string; value: CableEndpoint; onChange(v: CableEndpoint): void;
}) {
  const placement = design.placements.find((p) => p.id === value.placementId);
  const device = placement && lib.devices.get(placement.deviceId);
  const ports = device ? allPortRefs(device) : [];
  return (
    <div className="row2">
      <SelectField label={`${label} device`} value={value.placementId}
        options={design.placements.map((p) => ({ value: p.id, label: p.label }))}
        onChange={(placementId) => onChange({ placementId, portRef: '' })} />
      <SelectField label="Port" value={value.portRef}
        options={[{ value: '', label: '—' }, ...ports.map((r) => ({ value: r, label: r }))]}
        onChange={(portRef) => onChange({ ...value, portRef })} />
    </div>
  );
}

/** In-rack cable runs. Each run is quantity x (from -> to) of one media and length. */
export function CablesPanel({ lib, design, editor }: Props) {
  const media = lib.cableMedia.items();
  const first = design.placements[0]?.id ?? '';
  const add = () =>
    editor.addCable({
      from: { placementId: first, portRef: '' },
      to: { placementId: design.placements[1]?.id ?? first, portRef: '' },
      mediaId: media[0]?.id ?? '', lengthM: 2, quantity: 1,
    });
  const set = (c: CableRun, patch: Partial<CableRun>) => editor.updateCable(c.id, (x) => ({ ...x, ...patch }));
  return (
    <Section title="In-rack cables" actions={<Button onClick={add} disabled={!first}>+ Cable</Button>}>
      {design.cables.length === 0 && <p className="muted">No cables yet.</p>}
      {design.cables.map((c) => (
        <div key={c.id} className="card">
          <EndpointEditor lib={lib} design={design} label="From" value={c.from} onChange={(from) => set(c, { from })} />
          <EndpointEditor lib={lib} design={design} label="To" value={c.to} onChange={(to) => set(c, { to })} />
          <SelectField label="Media" value={c.mediaId} options={media.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(mediaId) => set(c, { mediaId })} />
          <div className="row2">
            <NumberField label="Length m" value={c.lengthM} min={0} step={0.5} onChange={(lengthM) => set(c, { lengthM })} />
            <NumberField label="Quantity" value={c.quantity} min={1} onChange={(quantity) => set(c, { quantity })} />
          </div>
          <Button variant="danger" onClick={() => editor.removeCable(c.id)}>Remove</Button>
        </div>
      ))}
    </Section>
  );
}
