import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatTiles, tileWidthOf } from '../../domain/layout/tiles';
import { formatPower } from '../../domain/units';
import { buildTree, matchesFilter, type SidebarItem, type TreeNode } from '../../ui/sidebar-tree';
import { Button } from '../../ui/button';

/** Drag payload: the rack design id, dropped on a row tile. */
export const RACK_DRAG_TYPE = 'application/x-dclab-rack';

interface Props {
  lib: Library;
  designs: RackDesign[];
  /** Palette rack picked by click (offered for Assign). */
  picked?: string;
  onPick(id: string | undefined): void;
  /** Free tiles currently selected on the plan (Assign is offered when > 0). */
  freeTiles: number;
  onAssign(designId: string): { error: boolean; lines: string[] };
}

/**
 * Rack palette (like the Rack Designer's device palette): every rack design, grouped by rack template. Drag a rack
 * onto a row tile, or select tiles on the plan, click a rack here and press Assign.
 */
export function RackPalette({ lib, designs, picked, onPick, freeTiles, onAssign }: Props) {
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ error: boolean; lines: string[] }>();
  const badge = (d: RackDesign) => `${formatTiles(tileWidthOf(lib, d))}T · ${formatPower(computeRackMetrics(lib, d).typicalW)}`;
  const items: SidebarItem[] = designs.map((d) => ({
    id: d.id, name: d.name, path: [lib.racks.get(d.templateId)?.name ?? d.templateId],
    keywords: `${d.abbr} ${d.id}`, badge: badge(d),
  })).filter((i) => matchesFilter(i, q));
  const toggle = (key: string) => setClosed((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const pickedDesign = designs.find((d) => d.id === picked);

  const Tree = ({ node, depth }: { node: TreeNode; depth: number }) => (
    <>
      {node.folders.map((f) => {
        const open = !!q || !closed.has(f.key);
        return (
          <div key={f.key}>
            <div className="tree-folder" style={{ paddingLeft: 12 + depth * 12 }} onClick={() => toggle(f.key)}>
              <span className="caret">{open ? '▾' : '▸'}</span>
              <span className="sidebar-item-name">{f.label}</span>
              <span className="badge">{f.items.length}</span>
            </div>
            {open && <Tree node={f} depth={depth + 1} />}
          </div>
        );
      })}
      {node.items.map((i) => {
        const d = designs.find((x) => x.id === i.id);
        if (!d) return null;
        const on = d.id === picked;
        return (
          <div key={d.id} className={`palette-item${on ? ' active' : ''}`} style={{ paddingLeft: 12 + depth * 12 }} draggable
            onDragStart={(e) => { e.dataTransfer.setData(RACK_DRAG_TYPE, d.id); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => { onPick(on ? undefined : d.id); setMsg(undefined); }}
            title="Drag onto a row tile, or select tiles on the plan, click here and Assign">
            <span className="caret" />
            <span className="sidebar-item-name">{`${d.abbr} · ${d.name}`}</span>
            <span className="badge">{i.badge}</span>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="palette">
      <div className="sidebar-group-title">Rack palette</div>
      <input placeholder="Filter racks…" value={q} onChange={(e) => setQ(e.target.value)} />
      {/* Assign line is always laid out so the list never moves when it appears. */}
      <div className="palette-action" style={{ visibility: pickedDesign ? 'visible' : 'hidden' }}>
        <Button variant="primary" disabled={!pickedDesign || freeTiles === 0}
          title={freeTiles ? `Assign ${pickedDesign?.name ?? ''} to the selected tiles` : 'Select free tiles on the plan'}
          onClick={() => pickedDesign && setMsg(onAssign(pickedDesign.id))}>
          {freeTiles > 1 ? `Assign ${freeTiles} racks` : 'Assign rack'}
        </Button>
        <span className="muted">{freeTiles ? `${freeTiles} free tile${freeTiles === 1 ? '' : 's'} selected` : 'select tiles on the plan'}</span>
      </div>
      {msg && msg.lines.map((l, i) => <p key={i} className={`pad ${msg.error ? 'error' : 'muted'}`}>{l}</p>)}
      <div className="palette-list">
        {designs.length === 0 ? <p className="muted pad">Create a rack design in Rack Designer first.</p> : <Tree node={buildTree(items)} depth={0} />}
      </div>
    </div>
  );
}
