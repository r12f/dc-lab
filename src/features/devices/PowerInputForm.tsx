import type { DeviceDefinition, PduInput, PsuSpec } from '../../domain/device/types';
import { Button } from '../../ui/Button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';

interface Props {
  device: DeviceDefinition;
  onChange(device: DeviceDefinition): void;
}

const DEFAULT_PSU: PsuSpec = { count: 2, inlet: 'C14', ratedW: 1100 };
const DEFAULT_PDU: PduInput = { phases: 3, voltageV: 415, inputCurrentA: 32, inputPlug: 'IEC 60309 32A' };

/** PSUs (rear, split left/right) and PDU input feed. */
export function PowerInputForm({ device: d, onChange }: Props) {
  const psu = d.psus;
  const pdu = d.pdu;
  return (
    <Section title="Power input">
      {psu ? (
        <div className="card">
          <div className="row3">
            <NumberField label="PSUs" value={psu.count} min={0} onChange={(count) => onChange({ ...d, psus: { ...psu, count } })} />
            <TextField label="Inlet" value={psu.inlet} onChange={(inlet) => onChange({ ...d, psus: { ...psu, inlet } })} />
            <NumberField label="Rated W" value={psu.ratedW} min={0} onChange={(ratedW) => onChange({ ...d, psus: { ...psu, ratedW } })} />
          </div>
          <p className="muted">PSUs are drawn on the rear, split evenly left/right.</p>
          <Button variant="danger" onClick={() => onChange({ ...d, psus: undefined })}>Remove PSUs</Button>
        </div>
      ) : (
        <Button onClick={() => onChange({ ...d, psus: DEFAULT_PSU })}>+ PSUs</Button>
      )}
      {d.category === 'pdu' && (pdu ? (
        <div className="card">
          <div className="row2">
            <SelectField label="Phases" value={String(pdu.phases)} options={[{ value: '1', label: '1-phase' }, { value: '3', label: '3-phase' }]}
              onChange={(v) => onChange({ ...d, pdu: { ...pdu, phases: Number(v) as 1 | 3 } })} />
            <NumberField label="Voltage V" value={pdu.voltageV} onChange={(voltageV) => onChange({ ...d, pdu: { ...pdu, voltageV } })} />
          </div>
          <div className="row2">
            <NumberField label="Input A" value={pdu.inputCurrentA} onChange={(inputCurrentA) => onChange({ ...d, pdu: { ...pdu, inputCurrentA } })} />
            <TextField label="Input plug" value={pdu.inputPlug} onChange={(inputPlug) => onChange({ ...d, pdu: { ...pdu, inputPlug } })} />
          </div>
        </div>
      ) : (
        <Button onClick={() => onChange({ ...d, pdu: DEFAULT_PDU })}>+ PDU input</Button>
      ))}
    </Section>
  );
}
