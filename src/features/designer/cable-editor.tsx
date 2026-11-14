import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, CableRun, RackDesign } from '../../domain/design/types';
import { estimateLengthM } from '../../domain/design/cabling';
import { cableEnds, cableIssues } from '../../domain/design/connectors';
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

/** Editor for one run: media, A end, B end(s), route, length, quantity, and connector checks. */
export function CableEditor({ lib, design, editor, c }: Props) {
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const set = (patch: Partial<CableRun>) => editor.updateCable(c.id, (x) => ({ ...x, ...patch }));
  const m = lib.cableMedia.get(c.mediaId);
  const ends = m ? cableEnds(m) : { a: '?', b: '?', bLegs: 1 };
  const estimate = estimateLengthM(lib, design, c);
  const issues = cableIssues(lib, design, c);
  const setTo = (i: number, ep: CableEndpoint) => set({ to: c.to.map((t, j) => (j === i ? ep : t)) });
  const addLeg = () => set({ to: [...c.to, { ...c.to[c.to.length - 1] ?? c.from, connector: undefined }] });
  return (
    <>
      <SelectField label="Cable" value={c.mediaId}
        options={media.map((x) => ({ value: x.id, label: x.breakout ? `${x.name} (breakout ${x.breakout.count}x ${x.breakout.connector})` : x.name }))}
        onChange={(mediaId) => set({ mediaId })} />
      <p className="muted">{`A end ${ends.a}${ends.bLegs > 1 ? ` · B end ${ends.bLegs}x ${ends.b}` : ''}`}</p>
      <EndpointEditor lib={lib} design={design} label="A" value={c.from} onChange={(from) => set({ from })} />
      {c.to.map((t, i) => (
        <div key={i}>
          <EndpointEditor lib={lib} design={design} label={ends.bLegs > 1 ? `B leg ${i + 1}` : 'B'} value={t} onChange={(ep) => setTo(i, ep)} />
          {c.to.length > 1 && <Button onClick={() => set({ to: c.to.filter((_, j) => j !== i) })}>Remove leg</Button>}
        </div>
      ))}
      {c.to.length < ends.bLegs && <Button onClick={addLeg}>{`+ B leg (${c.to.length}/${ends.bLegs})`}</Button>}
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
