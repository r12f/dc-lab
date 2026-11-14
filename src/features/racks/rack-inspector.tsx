import type { RackKind, RackTemplate } from '../../domain/rack/types';
import { RACK_KINDS } from '../../domain/rack/types';
import type { UnitSystem } from '../../domain/units';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/read-only-notice';
import { Button } from '../../ui/button';
import { downloadText } from '../../io/download';
import { SideElementsEditor } from './side-elements-editor';
import { CustomPropertiesSection } from '../properties/custom-properties-section';
import { defaultSideElements } from '../../domain/rack/side-elements';

interface Props {
  rack: RackTemplate;
  readOnly: boolean;
  onChange(rack: RackTemplate): void;
  onDuplicate(): void;
  selectedElementId?: string;
  onSelectElement(id: string | undefined): void;
}

const kindOptions = (Object.keys(RACK_KINDS) as RackKind[]).map((k) => ({ value: k, label: RACK_KINDS[k] }));
const systemOptions: { value: UnitSystem; label: string }[] = [{ value: 'RU', label: 'RU' }, { value: 'OU', label: 'OU' }];

const sideSignature = (els: { side: string; kind: string; widthMm: number }[]) => els.map((e) => `${e.side}:${e.kind}:${e.widthMm}`).join();

/** Changing kind swaps in that kind's default side elements, unless the user customised them. */
function withKind(r: RackTemplate, kind: RackKind): Partial<RackTemplate> {
  const untouched = sideSignature(r.sideElements) === sideSignature(defaultSideElements(r.kind, r.depthMm));
  return untouched ? { kind, sideElements: defaultSideElements(kind, r.depthMm) } : { kind };
}

export function RackInspector({ rack: r, readOnly, onChange, onDuplicate, selectedElementId, onSelectElement }: Props) {
  const set = (patch: Partial<RackTemplate>) => onChange({ ...r, ...patch });
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={r.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={r.name} onChange={(name) => set({ name })} />
          <SelectField<RackKind> label="Kind" value={r.kind} options={kindOptions} onChange={(kind) => set(withKind(r, kind))} />
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
            <NumberField label="Tiles wide" value={r.footprintTiles.wide} min={0.5} step={0.5}
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
          <TextField label="Notes" value={r.notes ?? ''} onChange={(notes) => set({ notes })} />
        </Section>
        <SideElementsEditor rack={r} onChange={onChange} selectedId={selectedElementId} onSelect={onSelectElement} />
      </fieldset>
      <CustomPropertiesSection target="rack" item={r} builtin={readOnly} onChange={(properties) => onChange({ ...r, properties })} />
      <Button onClick={() => downloadText(`${r.id}.json`, JSON.stringify({ schema: 'dc-lab/rack@1', ...r }, null, 2))}>
        Export rack JSON
      </Button>
    </div>
  );
}
