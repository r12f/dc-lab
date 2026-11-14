import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, CableRun, RackDesign } from '../../domain/design/types';
import { allPortRefs } from '../../domain/device/ports';
import { estimateLengthM } from '../../domain/design/cabling';
import { Button } from '../../ui/button';
import { NumberField, Section, SelectField } from '../../ui/fields';
import type { DesignEditor } from './use-design-editor';

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  selectedId?: string;
  onSelect(id: string | undefined): void;
  /** Device selected on the canvas; used as the start of a new run. */
  startPlacementId?: string;
}

const routeOptions: { value: CableRoute; label: string }[] = [
  { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' },
];

function EndpointEditor({ lib, design, label, value, onChange }: {
  lib: Library; design: RackDesign; label: string; value: CableEndpoint; onChange(v: CableEndpoint): void;
}) {
  const placement = design.placements.find((p) => p.id === value.placementId);
  const device = placement && lib.devices.get(placement.deviceId);
  const ports = device ? allPortRefs(device) : [];
  return (
    <div className="row2">
      <SelectField label={`${label} device`} value={value.placementId}
        options={design.placements.map((p) => ({ value: p.id, label: `${p.label} · ${lib.devices.get(p.deviceId)?.name ?? ''}` }))}
        onChange={(placementId) => onChange({ placementId, portRef: '' })} />
      <SelectField label={`${label} port`} value={value.portRef}
        options={[{ value: '', label: 'any' }, ...ports.map((r) => ({ value: r, label: r }))]}
        onChange={(portRef) => onChange({ ...value, portRef })} />
    </div>
  );
}

function runTitle(design: RackDesign, c: CableRun): string {
  const label = (ep: CableEndpoint) => {
    const p = design.placements.find((x) => x.id === ep.placementId);
    return `${p?.label ?? '?'}${ep.portRef ? `:${ep.portRef}` : ''}`;
  };
  return `${label(c.from)} → ${label(c.to)} · ${c.route}`;
}

function CableEditor({ lib, design, editor, c }: { lib: Library; design: RackDesign; editor: DesignEditor; c: CableRun }) {
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const set = (patch: Partial<CableRun>) => editor.updateCable(c.id, (x) => ({ ...x, ...patch }));
  const estimate = estimateLengthM(lib, design, c);
  return (
    <>
      <EndpointEditor lib={lib} design={design} label="Start" value={c.from} onChange={(from) => set({ from })} />
      <EndpointEditor lib={lib} design={design} label="End" value={c.to} onChange={(to) => set({ to })} />
      <div className="row2">
        <SelectField<CableRoute> label="Route" value={c.route} options={routeOptions} onChange={(route) => set({ route })} />
        <SelectField label="Media" value={c.mediaId} options={media.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(mediaId) => set({ mediaId })} />
      </div>
      <div className="row3">
        <SelectField label="Length" value={c.lengthM === undefined ? 'auto' : 'manual'}
          options={[{ value: 'auto', label: `auto (${estimate ?? '?'} m)` }, { value: 'manual', label: 'manual' }]}
          onChange={(v) => set({ lengthM: v === 'auto' ? undefined : estimate ?? 2 })} />
        <NumberField label="Length m" value={c.lengthM ?? estimate ?? 0} min={0} step={0.5}
          disabled={c.lengthM === undefined} onChange={(lengthM) => set({ lengthM })} />
        <NumberField label="Quantity" value={c.quantity} min={1} onChange={(quantity) => set({ quantity })} />
      </div>
    </>
  );
}

/** In-rack cable runs: start/end device and port, side route, media, length, quantity. */
export function CablesPanel({ lib, design, editor, selectedId, onSelect, startPlacementId }: Props) {
  const placements = design.placements;
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const add = () => {
    const from = placements.find((p) => p.id === startPlacementId) ?? placements[0];
    const to = placements.find((p) => p.id !== from?.id) ?? from;
    if (!from || !to) return;
    const id = editor.addCable({
      from: { placementId: from.id, portRef: '' }, to: { placementId: to.id, portRef: '' },
      route: 'left', mediaId: media[0]?.id ?? '', quantity: 1,
    });
    onSelect(id);
  };
  return (
    <Section title="In-rack cables" actions={<Button onClick={add} disabled={placements.length === 0}>+ Cable</Button>}>
      {design.cables.length === 0 && <p className="muted">No cables yet. Add a run, then pick start, end and side.</p>}
      {design.cables.map((c) => (
        <details key={c.id} className="card" open={c.id === selectedId}
          onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && c.id !== selectedId && onSelect(c.id)}>
          <summary>
            <span className="swatch" style={{ background: lib.cableMedia.get(c.mediaId)?.color, display: 'inline-block', marginRight: 6 }} />
            {`${runTitle(design, c)} · ×${c.quantity}`}
          </summary>
          <CableEditor lib={lib} design={design} editor={editor} c={c} />
          <Button variant="danger" onClick={() => { editor.removeCable(c.id); onSelect(undefined); }}>Remove</Button>
        </details>
      ))}
    </Section>
  );
}
