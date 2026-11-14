import type { RackKind, RackTemplate } from '../../domain/rack/types';
import { RACK_KINDS } from '../../domain/rack/types';
import type { UnitSystem } from '../../domain/units';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/ReadOnlyNotice';
import { Button } from '../../ui/Button';
import { downloadText } from '../../io/download';

interface Props {
  rack: RackTemplate;
  readOnly: boolean;
  onChange(rack: RackTemplate): void;
  onDuplicate(): void;
}

const kindOptions = (Object.keys(RACK_KINDS) as RackKind[]).map((k) => ({ value: k, label: RACK_KINDS[k] }));
const systemOptions: { value: UnitSystem; label: string }[] = [{ value: 'RU', label: 'RU' }, { value: 'OU', label: 'OU' }];

export function RackInspector({ rack: r, readOnly, onChange, onDuplicate }: Props) {
  const set = (patch: Partial<RackTemplate>) => onChange({ ...r, ...patch });
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={r.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={r.name} onChange={(name) => set({ name })} />
          <SelectField<RackKind> label="Kind" value={r.kind} options={kindOptions} onChange={(kind) => set({ kind })} />
          <div className="row2">
            <NumberField label="Units" value={r.units} min={1} onChange={(units) => set({ units })} />
            <SelectField<UnitSystem> label="Unit" value={r.unitSystem} options={systemOptions} onChange={(unitSystem) => set({ unitSystem })} />
          </div>
        </Section>
        <Section title="Dimensions">
          <div className="row3">
            <NumberField label="Width mm" value={r.widthMm} onChange={(widthMm) => set({ widthMm })} />
            <NumberField label="Depth mm" value={r.depthMm} onChange={(depthMm) => set({ depthMm })} />
            <NumberField label="Height mm" value={r.heightMm} onChange={(heightMm) => set({ heightMm })} />
          </div>
          <div className="row2">
            <NumberField label="Tiles wide" value={r.footprintTiles.wide} min={1}
              onChange={(wide) => set({ footprintTiles: { ...r.footprintTiles, wide } })} />
            <NumberField label="Tiles deep" value={r.footprintTiles.deep} min={1}
              onChange={(deep) => set({ footprintTiles: { ...r.footprintTiles, deep } })} />
          </div>
        </Section>
        <Section title="Limits">
          <div className="row3">
            <NumberField label="Empty kg" value={r.emptyWeightKg} onChange={(emptyWeightKg) => set({ emptyWeightKg })} />
            <NumberField label="Max load kg" value={r.maxLoadKg} onChange={(maxLoadKg) => set({ maxLoadKg })} />
            <NumberField label="Max power W" value={r.maxPowerW} onChange={(maxPowerW) => set({ maxPowerW })} />
          </div>
          <div className="row2">
            <NumberField label="Side pod L slots" value={r.sidePods.left} min={0}
              onChange={(left) => set({ sidePods: { ...r.sidePods, left } })} />
            <NumberField label="Side pod R slots" value={r.sidePods.right} min={0}
              onChange={(right) => set({ sidePods: { ...r.sidePods, right } })} />
          </div>
          <TextField label="Notes" value={r.notes ?? ''} onChange={(notes) => set({ notes })} />
        </Section>
      </fieldset>
      <Button onClick={() => downloadText(`${r.id}.json`, JSON.stringify({ schema: 'dc-lab/rack@1', ...r }, null, 2))}>
        Export rack JSON
      </Button>
    </div>
  );
}
