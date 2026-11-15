import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { Placement } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { formatHeight, formatPower } from '../../domain/units';
import { Button } from '../../ui/button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { DeviceDrawing } from '../devices/drawing/device-drawing';
import { resolvePlacedPort } from '../../domain/design/optics';
import { variantLabel } from '../../domain/items/variants';
import type { DesignEditor } from './use-design-editor';
import { isRepeatable } from '../../domain/device/categories';
import { findProfile } from '../../domain/device/breakout';
import { repeatCount, sizedDevice } from '../../domain/design/sizing';
import { GroupOpticsEditor } from './group-optics-editor';
import { PortConfigEditor } from './port-config-editor';

interface Props {
  lib: Library;
  placement: Placement;
  templateId: string;
  editor: DesignEditor;
  onRemoved(): void;
  /** Shows a rejected change (e.g. a filler grown into another device). */
  onError(message: string | undefined): void;
}

const faceOptions = [{ value: 'front' as PortFace, label: 'Front' }, { value: 'rear' as PortFace, label: 'Rear' }];

export function PlacementPanel({ lib, placement: p, templateId, editor, onRemoved, onError }: Props) {
  const [port, setPort] = useState<string>();
  const device = lib.devices.get(p.deviceId);
  if (!device) return <p className="muted">Unknown device {p.deviceId}</p>;
  const update = (fn: (x: Placement) => Placement) => editor.updatePlacement(p.id, fn);
  const placed = sizedDevice(device, lib.racks.get(templateId), p.repeat);
  const n = repeatCount(device, p.repeat);
  const mount = p.mount;

  return (
    <>
      <Section title="Instance">
        <TextField label="Label" value={p.label} onChange={(label) => update((x) => ({ ...x, label }))} />
        <p className="muted">{`${placed.name}${n > 1 ? ` ×${n}` : ''} · ${formatHeight(placed.height)} · ${formatPower(placed.power.typicalW)}`}</p>
        {isRepeatable(device) && mount.kind === 'rack' && (
          <NumberField label={`Repeat (× ${formatHeight(sizedDevice(device, lib.racks.get(templateId)).height)} each)`} value={n} min={1}
            onChange={(r) => onError(editor.setRepeat(p.id, Math.max(1, Math.round(r))))} />
        )}
        {mount.kind === 'rack' ? (
          <div className="row2">
            <NumberField label="Bottom unit" value={mount.position} min={1}
              onChange={(position) => editor.moveTo(p.id, { ...mount, position })} />
            <SelectField<PortFace> label="Face" value={mount.face} options={faceOptions}
              onChange={(face) => editor.moveTo(p.id, { ...mount, face })} />
          </div>
        ) : (
          <p className="muted">{`${lib.racks.get(templateId)?.sideElements.find((e) => e.id === mount.elementId)?.name ?? mount.elementId}, slot ${mount.slot}`}</p>
        )}
        <SelectField
          label="Item (vendor / model)"
          value={lib.variants.resolve(device.id, p.variantId)?.id ?? ''}
          options={lib.variants.of(device.id).map((v) => ({
            value: v.id, label: `${variantLabel(v) || v.id}${v.id === lib.variants.defaultOf(device.id)?.id ? ' (default)' : ''}`,
          }))}
          onChange={(v) => update((x) => ({ ...x, variantId: v === lib.variants.defaultOf(device.id)?.id ? undefined : v }))}
        />
        <SelectField
          label="Breakout profile"
          value={p.breakoutProfileId ?? ''}
          options={[{ value: '', label: `Device default (${findProfile(device)?.name ?? 'native'})` }, ...device.breakoutProfiles.map((x) => ({ value: x.id, label: x.name }))]}
          onChange={(v) => update((x) => ({ ...x, breakoutProfileId: v || undefined }))}
        />
      </Section>
      <GroupOpticsEditor lib={lib} device={device} placement={p} onChange={update} />
      <Section title="Ports">
        <div className="mini-faceplate">
          <DeviceDrawing device={device} compact ctx={{
            lib,
            resolve: (r) => resolvePlacedPort(lib, device, p, r),
            selectedPorts: new Set(port ? [port] : []),
            onPortClick: (r) => setPort(r),
          }} />
        </div>
        {port ? (
          <PortConfigEditor lib={lib} device={device} placement={p} portRef={port} onChange={update} />
        ) : (
          <p className="muted">Click a port to override its breakout or optic.</p>
        )}
      </Section>
      <Button variant="danger" onClick={() => { editor.removePlacement(p.id); onRemoved(); }}>Remove device</Button>
    </>
  );
}
