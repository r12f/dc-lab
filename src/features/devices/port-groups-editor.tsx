import { formatGbps } from '../../domain/units';
import type { DeviceDefinition, OpticalEngine, Phase, PortFace, PortGroup, PortRole } from '../../domain/device/types';
import { FORM_FACTORS, formFactorSpec, HEAT_SINKS, heatSinkOf, type HeatSink } from '../../domain/ports/form-factors';
import { newPortGroup } from '../../domain/device/factory';
import { PORT_ROLES, ROLE_TRAITS } from '../../domain/device/roles';
import { uniqueId } from '../../domain/ids';
import { groupConnector } from '../../domain/device/port-label';
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
const orderOptions = [
  { value: 'column-major', label: 'Columns, top down' },
  { value: 'column-major:up', label: 'Columns, bottom up' },
  { value: 'row-major', label: 'Rows, top down' },
  { value: 'row-major:up', label: 'Rows, bottom up' },
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
      <summary>{`${group.label}${group.passThrough ? ' ⇄' : ''} · ${group.count}x ${groupConnector(group)}${group.heatSink ? ` ${group.heatSink}` : ''}${group.opticalEngine ? ` ${group.opticalEngine.toUpperCase()}` : ''}${group.speedGbps ? ` ${formatGbps(group.speedGbps)}` : ''} · ${group.face}`}</summary>
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
      <div className="row3">
        <SelectField<string> label="Port order" value={`${group.fill ?? 'column-major'}${group.bottomUp ? ':up' : ''}`}
          options={orderOptions} onChange={(v) => {
            const [fill, up] = v.split(':');
            set({ fill: fill === 'row-major' ? 'row-major' : undefined, bottomUp: up ? true : undefined });
          }} />
        <NumberField label="Ports per number (1A, 1B…)" value={group.subPorts ?? 1} min={1}
          onChange={(n) => set({ subPorts: n > 1 ? n : undefined })} />
        <NumberField label="First number" value={group.firstNumber ?? 1} min={0}
          onChange={(n) => set({ firstNumber: n !== 1 ? n : undefined })} />
      </div>
      <NumberField label="Face row (0 = top; groups of a row run left to right)" value={group.faceRow ?? 0} min={0}
        onChange={(n) => set({ faceRow: n > 0 ? n : undefined })} />
      <label className="checkbox">
        <input type="checkbox" checked={!!group.passThrough}
          onChange={(e) => set({ passThrough: e.target.checked ? { rearId: `${group.id}-r` } : undefined })} />
        Pass-through (each port continues to the same port on the other face — patch panel / fiber housing adapters, RJ45 couplers)
      </label>
      {group.passThrough && (
        <div className="row3">
          <TextField label="Other face group id" value={group.passThrough.rearId}
            onChange={(rearId) => rearId && set({ passThrough: { ...group.passThrough!, rearId } })} />
          <TextField label="Other face label" value={group.passThrough.rearLabel ?? ''}
            onChange={(v) => set({ passThrough: { ...group.passThrough!, rearLabel: v || undefined } })} />
          {formFactorSpec(group.formFactor).kind === 'fiber' && (
            <SelectField<'' | ConnectorGender> label="Other face takes" value={group.passThrough.rearCableGender ?? ''}
              options={[{ value: '', label: '— same as this face —' }, ...genderOptions.slice(1)]}
              onChange={(g) => set({ passThrough: { ...group.passThrough!, rearCableGender: g || undefined } })} />
          )}
        </div>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={!!group.rightToLeft} onChange={(e) => set({ rightToLeft: e.target.checked || undefined })} />
        Mirrored left to right (a pass-through group's other face is mirrored automatically)
      </label>
      <TextField label="Port numbers in fill order (blank = 1, 2, 3…; e.g. 1, 2, 3, 4, 5, 6, 10, 7, 8, 9)"
        value={(group.portNumbers ?? []).join(', ')} onChange={(v) => {
          const nums = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
          set({ portNumbers: nums.length ? nums : undefined });
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
      {formFactorSpec(group.formFactor).kind === 'fiber' && (
        <div className="row2">
          <NumberField label="Connectors per port" value={group.connectorsPerPort ?? 1} min={1}
            onChange={(n) => set({ connectorsPerPort: n > 1 ? n : undefined })} />
          <SelectField label="Connector layout" value={group.connectorLayout ?? 'side-by-side'}
            options={[{ value: 'side-by-side', label: 'Side by side (1 left)' }, { value: 'stacked', label: 'Stacked (1 at the bottom)' }]}
            onChange={(v) => set({ connectorLayout: v === 'stacked' ? 'stacked' : undefined })} />
        </div>
      )}
      {formFactorSpec(group.formFactor).kind === 'fiber' && <EngineFields group={group} set={set} />}
      {group.role === 'outlet' && <OutletFields group={group} set={set} />}
      <Button variant="danger" onClick={onRemove}>Remove group</Button>
    </details>
  );
}

export function PortGroupsEditor({ device, onChange }: Props) {
  // Derived other-face groups of pass-through groups are not edited (they follow their group); ids of both taken.
  const own = device.ports.filter((g) => !g.passThroughOf);
  const setPorts = (ports: PortGroup[]) => onChange({ ...device, ports });
  const add = () => setPorts([...own, newPortGroup(uniqueId('ports', device.ports.map((p) => p.id)))]);
  return (
    <Section title="Port groups" actions={<Button onClick={add}>+ Group</Button>}>
      {own.map((g) => (
        <PortGroupForm key={g.id} group={g}
          onChange={(ng) => setPorts(own.map((x) => (x.id === g.id ? ng : x)))}
          onRemove={() => setPorts(own.filter((x) => x.id !== g.id))} />
      ))}
    </Section>
  );
}
