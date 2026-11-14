import type { DeviceDefinition, PortFace, PortGroup } from '../../domain/device/types';
import { newPortGroup } from '../../domain/device/factory';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/Button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';

interface Props {
  device: DeviceDefinition;
  onChange(device: DeviceDefinition): void;
}

const faceOptions = [{ value: 'front' as PortFace, label: 'Front' }, { value: 'rear' as PortFace, label: 'Rear' }];

function PortGroupForm({ group, onChange, onRemove }: { group: PortGroup; onChange(g: PortGroup): void; onRemove(): void }) {
  const set = (patch: Partial<PortGroup>) => onChange({ ...group, ...patch });
  return (
    <div className="card">
      <div className="row2">
        <TextField label="Label" value={group.label} onChange={(label) => set({ label })} />
        <TextField label="Connector" value={group.connector} onChange={(connector) => set({ connector })} />
      </div>
      <div className="row3">
        <NumberField label="Count" value={group.count} min={0} onChange={(count) => set({ count })} />
        <NumberField label="Speed G" value={group.speedGbps} min={0} onChange={(speedGbps) => set({ speedGbps })} />
        <NumberField label="Lanes" value={group.lanes} min={1} onChange={(lanes) => set({ lanes })} />
      </div>
      <div className="row2">
        <SelectField<PortFace> label="Face" value={group.face} options={faceOptions} onChange={(face) => set({ face })} />
        <NumberField label="Rows" value={group.rows} min={1} onChange={(rows) => set({ rows })} />
      </div>
      <TextField
        label="Breakout modes (comma separated, e.g. 2x400G, 4x200G)"
        value={group.breakoutModes.join(', ')}
        onChange={(v) => set({ breakoutModes: v.split(',').map((s) => s.trim()).filter(Boolean) })}
      />
      <Button variant="danger" onClick={onRemove}>Remove group</Button>
    </div>
  );
}

export function PortGroupsEditor({ device, onChange }: Props) {
  const setPorts = (ports: PortGroup[]) => onChange({ ...device, ports });
  const add = () => setPorts([...device.ports, newPortGroup(uniqueId('ports', device.ports.map((p) => p.id)))]);
  return (
    <Section title="Port groups" actions={<Button onClick={add}>+ Group</Button>}>
      {device.ports.map((g) => (
        <PortGroupForm
          key={g.id}
          group={g}
          onChange={(ng) => setPorts(device.ports.map((x) => (x.id === g.id ? ng : x)))}
          onRemove={() => setPorts(device.ports.filter((x) => x.id !== g.id))}
        />
      ))}
    </Section>
  );
}
