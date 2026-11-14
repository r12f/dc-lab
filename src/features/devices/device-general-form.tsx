import type { DeviceCategory, DeviceDefinition } from '../../domain/device/types';
import { DEVICE_CATEGORIES, traitsOf } from '../../domain/device/categories';
import type { UnitSystem } from '../../domain/units';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';

interface Props {
  device: DeviceDefinition;
  onChange(device: DeviceDefinition): void;
}

const categoryOptions = DEVICE_CATEGORIES.map((c) => ({ value: c, label: traitsOf(c).label }));
const systemOptions = [{ value: 'RU' as UnitSystem, label: 'RU' }, { value: 'OU' as UnitSystem, label: 'OU' }];

export function DeviceGeneralForm({ device: d, onChange }: Props) {
  const set = (patch: Partial<DeviceDefinition>) => onChange({ ...d, ...patch });
  return (
    <Section title="General">
      <TextField label="Id" value={d.id} onChange={() => undefined} disabled />
      <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
      <div className="row2">
        <TextField label="Vendor" value={d.vendor} onChange={(vendor) => set({ vendor })} />
        <TextField label="Model / Vendor PN" value={d.model} onChange={(model) => set({ model })} />
      </div>
      <SelectField<DeviceCategory> label="Category" value={d.category} options={categoryOptions}
        onChange={(category) => set({ category })} />
      <div className="row2">
        <NumberField label="Height" value={d.height.units} min={0}
          onChange={(units) => set({ height: { ...d.height, units } })} />
        <SelectField<UnitSystem> label="Unit" value={d.height.system} options={systemOptions}
          onChange={(system) => set({ height: { ...d.height, system } })} />
      </div>
      <div className="row2">
        <NumberField label="Depth (mm)" value={d.depthMm} min={0} onChange={(depthMm) => set({ depthMm })} />
        <NumberField label="Weight (kg)" value={d.weightKg} min={0} step={0.1} onChange={(weightKg) => set({ weightKg })} />
      </div>
      <div className="row2">
        <NumberField label="Typical W" value={d.power.typicalW} min={0}
          onChange={(typicalW) => set({ power: { ...d.power, typicalW } })} />
        <NumberField label="Max W" value={d.power.maxW} min={0}
          onChange={(maxW) => set({ power: { ...d.power, maxW } })} />
      </div>
      {traitsOf(d.category).suppliesPower && (
        <NumberField label="Supply capacity W" value={d.power.capacityW ?? 0} min={0}
          onChange={(capacityW) => set({ power: { ...d.power, capacityW } })} />
      )}
    </Section>
  );
}
