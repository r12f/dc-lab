import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, CableRun, RackDesign } from '../../domain/design/types';
import type { CableEnd } from '../../domain/optics/types';
import { estimateLengthM } from '../../domain/design/cabling';
import { cableIssues } from '../../domain/design/connectors';
import { cableSummary, describeEnd, fiberMap } from '../../domain/optics/fiber-map';
import { Button } from '../../ui/button';
import { NumberField, SelectField } from '../../ui/fields';
import type { DesignEditor } from './use-design-editor';
import { EndpointEditor } from './endpoint-editor';

const routeOptions: { value: CableRoute; label: string }[] = [
  { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' },
];

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  c: CableRun;
}

/** Endpoints of one cable end; connectors can be added up to the end's connector count. */
function EndList({ lib, design, side, end, eps, onChange }: {
  lib: Library; design: RackDesign; side: 'A' | 'B'; end: CableEnd | undefined; eps: CableEndpoint[]; onChange(eps: CableEndpoint[]): void;
}) {
  const max = end?.count ?? 1;
  const add = () => onChange([...eps, { ...(eps[eps.length - 1] ?? { placementId: design.placements[0]?.id ?? '', portRef: '' }), connector: undefined }]);
  return (
    <>
      {eps.map((ep, i) => (
        <div key={i}>
          <EndpointEditor lib={lib} design={design} label={max > 1 ? `${side}${i + 1}` : side} value={ep}
            onChange={(v) => onChange(eps.map((x, j) => (j === i ? v : x)))} />
          {eps.length > 1 && <Button onClick={() => onChange(eps.filter((_, j) => j !== i))}>{`Remove ${side}${i + 1}`}</Button>}
        </div>
      ))}
      {eps.length < max && <Button onClick={add}>{`+ ${side} connector (${eps.length}/${max})`}</Button>}
    </>
  );
}

/** Editor for one run: cable, A and B connectors, route, length, quantity, and checks. */
export function CableEditor({ lib, design, editor, c }: Props) {
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const set = (patch: Partial<CableRun>) => editor.updateCable(c.id, (x) => ({ ...x, ...patch }));
  const m = lib.cableMedia.get(c.mediaId);
  const fm = m && fiberMap(m);
  const estimate = estimateLengthM(lib, design, c);
  const issues = cableIssues(lib, design, c);
  return (
    <>
      <SelectField label="Cable" value={c.mediaId}
        options={media.map((x) => ({ value: x.id, label: `${x.name} · ${cableSummary(x)}` }))}
        onChange={(mediaId) => set({ mediaId })} />
      {m && fm && (
        <p className="muted">{`A ${describeEnd(m.ends.a)} · B ${describeEnd(m.ends.b)} · ${m.mapping} · ${fm.links.length}F used`
          + `${fm.unusedA ? ` · ${fm.unusedA}F unused on A` : ''}${fm.unusedB ? ` · ${fm.unusedB}F unused on B` : ''}`}</p>
      )}
      <EndList lib={lib} design={design} side="A" end={m?.ends.a} eps={c.from} onChange={(from) => set({ from })} />
      <EndList lib={lib} design={design} side="B" end={m?.ends.b} eps={c.to} onChange={(to) => set({ to })} />
      <div className="row2">
        <SelectField<CableRoute> label="Route" value={c.route} options={routeOptions} onChange={(route) => set({ route })} />
        <NumberField label="Quantity" value={c.quantity} min={1} onChange={(quantity) => set({ quantity })} />
      </div>
      <div className="row2">
        <SelectField label="Length" value={c.lengthM === undefined ? 'auto' : 'manual'}
          options={[{ value: 'auto', label: `auto (${estimate ?? '?'} m)` }, { value: 'manual', label: 'manual' }]}
          onChange={(v) => set({ lengthM: v === 'auto' ? undefined : estimate ?? 2 })} />
        <NumberField label="Length m" value={c.lengthM ?? estimate ?? 0} min={0} step={0.5}
          disabled={c.lengthM === undefined} onChange={(lengthM) => set({ lengthM })} />
      </div>
      {issues.map((x) => <p key={x} className="warn">{x}</p>)}
    </>
  );
}
