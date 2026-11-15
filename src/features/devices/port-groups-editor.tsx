import { formatGbps } from '../../domain/units';
import type { DeviceDefinition, OpticalEngine, Phase, PortFace, PortGroup, PortRole } from '../../domain/device/types';
import { FORM_FACTORS, formFactorSpec, HEAT_SINKS, heatSinkOf, type HeatSink } from '../../domain/ports/form-factors';
import { newPortGroup } from '../../domain/device/factory';
import { PORT_ROLES, ROLE_TRAITS } from '../../domain/device/roles';
import { uniqueId } from '../../domain/ids';
import type { ConnectorGender } from '../../domain/optics/types';
import { Button } from '../../ui/button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';

interface Props {
  device: DeviceDefinition;
  onChange(device: DeviceDefinition): void;
}

const genderOptions: { value: '' | ConnectorGender; label: string }[] = [
  { value: '', label: '— not set —' }, { value: 'male', label: 'Male (pinned plug)' }, { value: 'female', label: 'Female (unpinned plug)' },
];
const faceOptions = [{ value: 'front' as PortFace, label: 'Front' }, { value: 'rear' as PortFace, label: 'Rear' }];
const roleOptions = PORT_ROLES.map((r) => ({ value: r, label: ROLE_TRAITS[r].label }));
const PHASES: Phase[] = ['L1', 'L2', 'L3', 'L1-L2', 'L2-L3', 'L3-L1'];
const phaseOptions = [{ value: '', label: '—' }, ...PHASES.map((p) => ({ value: p, label: p }))];

/** Registry form factors grouped by kind; keeps an unknown current value selectable. */
function formFactorOptions(current: string) {
  const ids = FORM_FACTORS.map((f) => f.id);
  const list = ids.includes(current) ? ids : [current, ...ids];
  return list.map((id) => ({ value: id, label: `${id} (${formFactorSpec(id).kind})` }));
}

const engineOptions = [{ value: 'cpo' as OpticalEngine, label: 'CPO (co-packaged)' }, { value: 'npo' as OpticalEngine, label: 'NPO (near-packaged)' }];

function EngineFields({ group, set }: { group: PortGroup; set(p: Partial<PortGroup>): void }) {
  return (
    <div className="row2">
      <SelectField<OpticalEngine> label="Optical engine" value={group.opticalEngine ?? 'cpo'} options={engineOptions}
        onChange={(opticalEngine) => set({ opticalEngine })} />
      <TextField label="Supported reaches" value={(group.reaches ?? []).join(', ')}
        onChange={(v) => set({ reaches: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
    </div>
  );
}

function OutletFields({ group, set }: { group: PortGroup; set(p: Partial<PortGroup>): void }) {
  return (
    <div className="row3">
      <TextField label="Bank" value={group.bank ?? ''} onChange={(bank) => set({ bank: bank || undefined })} />
      <SelectField label="Phase" value={group.phase ?? ''} options={phaseOptions}
        onChange={(v) => set({ phase: (v || undefined) as Phase | undefined })} />
      <NumberField label="Breaker A" value={group.breakerA ?? 0} min={0} onChange={(breakerA) => set({ breakerA: breakerA || undefined })} />
    </div>
  );
}

function PortGroupForm({ group, onChange, onRemove }: { group: PortGroup; onChange(g: PortGroup): void; onRemove(): void }) {
  const set = (patch: Partial<PortGroup>) => onChange({ ...group, ...patch });
  const pluggable = ROLE_TRAITS[group.role].pluggable;
  return (
    <details className="card" open={false}>
      <summary>{`${group.label} · ${group.count}x ${group.formFactor}${group.heatSink ? ` ${group.heatSink}` : ''}${group.opticalEngine ? ` ${group.opticalEngine.toUpperCase()}` : ''}${group.speedGbps ? ` ${formatGbps(group.speedGbps)}` : ''} · ${group.face}`}</summary>
      <div className="row2">
        <TextField label="Label" value={group.label} onChange={(label) => set({ label })} />
        <SelectField<PortRole> label="Role" value={group.role} options={roleOptions} onChange={(role) => set({ role })} />
      </div>
      <div className="row3">
        <SelectField label="Form factor" value={group.formFactor} options={formFactorOptions(group.formFactor)}
          onChange={(formFactor) => set({ formFactor, opticalEngine: formFactorSpec(formFactor).kind === 'fiber' ? group.opticalEngine ?? 'cpo' : undefined })} />
        <NumberField label="Count" value={group.count} min={0} onChange={(count) => set({ count })} />
        <NumberField label="Speed G" value={group.speedGbps} min={0} onChange={(speedGbps) => set({ speedGbps })} />
      </div>
      <div className="row3">
        <SelectField<PortFace> label="Face" value={group.face} options={faceOptions} onChange={(face) => set({ face })} />
        <NumberField label="Rows" value={group.rows} min={1} onChange={(rows) => set({ rows })} />
        <NumberField label="Lanes" value={group.lanes} min={1} onChange={(lanes) => set({ lanes })} />
      </div>
      <TextField label="Empty cells (column-major grid indices, e.g. 2, 3, 4, 5)" value={(group.holes ?? []).join(', ')}
        onChange={(v) => {
          const holes = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 0);
          set({ holes: holes.length ? holes : undefined });
        }} />
      {pluggable && formFactorSpec(group.formFactor).kind === 'cage' && (
        <SelectField<HeatSink> label="Heat sink (module must match)" value={heatSinkOf(group)}
          options={HEAT_SINKS.map((h) => ({ value: h, label: h === 'IHS' ? 'IHS (integrated)' : 'RHS (riding / cold plate)' }))}
          onChange={(heatSink) => set({ heatSink })} />
      )}
      {pluggable && (
        <TextField label="Breakout modes (e.g. 2x400G, 4x200G)" value={group.breakoutModes.join(', ')}
          onChange={(v) => set({ breakoutModes: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
      )}
      {formFactorSpec(group.formFactor).kind === 'fiber' && (
        <SelectField<'' | ConnectorGender> label="Takes cable connector" value={group.cableGender ?? ''}
          options={genderOptions} onChange={(g) => set({ cableGender: g || undefined })} />
      )}
      {formFactorSpec(group.formFactor).kind === 'fiber' && <EngineFields group={group} set={set} />}
      {group.role === 'outlet' && <OutletFields group={group} set={set} />}
      <Button variant="danger" onClick={onRemove}>Remove group</Button>
    </details>
  );
}

export function PortGroupsEditor({ device, onChange }: Props) {
  const setPorts = (ports: PortGroup[]) => onChange({ ...device, ports });
  const add = () => setPorts([...device.ports, newPortGroup(uniqueId('ports', device.ports.map((p) => p.id)))]);
  return (
    <Section title="Port groups" actions={<Button onClick={add}>+ Group</Button>}>
      {device.ports.map((g) => (
        <PortGroupForm key={g.id} group={g}
          onChange={(ng) => setPorts(device.ports.map((x) => (x.id === g.id ? ng : x)))}
          onRemove={() => setPorts(device.ports.filter((x) => x.id !== g.id))} />
      ))}
    </Section>
  );
}
