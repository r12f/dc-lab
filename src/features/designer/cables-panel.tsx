import type { Library } from '../../domain/library/library';
import type { CableRun, RackDesign } from '../../domain/design/types';
import { cableIssues, endpointLabel } from '../../domain/design/connectors';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';
import type { DesignEditor } from './use-design-editor';
import { CableEditor } from './cable-editor';

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  selectedId?: string;
  onSelect(id: string | undefined): void;
  /** Device selected on the canvas; used as the A end of a new run. */
  startPlacementId?: string;
}

function runTitle(design: RackDesign, c: CableRun): string {
  const list = (eps: CableRun['from']) => eps.map((t) => endpointLabel(design, t)).join(', ') || '—';
  return `${list(c.from)} → ${list(c.to)} · ${c.route}`;
}

/** In-rack cable runs, connector to connector; breakout cables have several B ends. */
export function CablesPanel({ lib, design, editor, selectedId, onSelect, startPlacementId }: Props) {
  const placements = design.placements;
  const media = lib.cableMedia.items().filter((m) => m.type !== 'power');
  const add = () => {
    const from = placements.find((p) => p.id === startPlacementId) ?? placements[0];
    const to = placements.find((p) => p.id !== from?.id) ?? from;
    if (!from || !to) return;
    const id = editor.addCable({
      from: [{ placementId: from.id, portRef: '' }], to: [{ placementId: to.id, portRef: '' }],
      route: 'left', mediaId: media[0]?.id ?? '', quantity: 1,
    });
    onSelect(id);
  };
  return (
    <Section title="In-rack cables" actions={<Button onClick={add} disabled={placements.length === 0}>+ Cable</Button>}>
      {design.cables.length === 0 && <p className="muted">No cables yet. Add a run, then pick its A and B connectors and side.</p>}
      {design.cables.map((c) => (
        <details key={c.id} className="card" open={c.id === selectedId}
          onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && c.id !== selectedId && onSelect(c.id)}>
          <summary>
            <span className="swatch" style={{ background: lib.cableMedia.get(c.mediaId)?.color, display: 'inline-block', marginRight: 6 }} />
            {`${runTitle(design, c)} · ×${c.quantity}${cableIssues(lib, design, c).length ? ' ⚠' : ''}`}
          </summary>
          <CableEditor lib={lib} design={design} editor={editor} c={c} />
          <Button variant="danger" onClick={() => { editor.removeCable(c.id); onSelect(undefined); }}>Remove</Button>
        </details>
      ))}
    </Section>
  );
}
