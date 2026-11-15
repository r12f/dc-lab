import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DeviceDefinition } from '../../domain/device/types';
import type { RackTemplate } from '../../domain/rack/types';
import { categoryFolder, isRepeatable, traitsOf } from '../../domain/device/categories';
import { deviceSortKey } from '../../domain/device/ports';
import { fitsRackUnits } from '../../domain/design/placement';
import { variantLabel } from '../../domain/items/variants';
import { formatHeight } from '../../domain/units';
import { buildTree, matchesFilter, type SidebarItem, type TreeNode } from '../../ui/sidebar-tree';
import { categoryStyle } from '../../theme/paint';

/** Drag payload: "deviceId" or "deviceId|variantId". */
export const DEVICE_DRAG_TYPE = 'application/x-dclab-device';

interface Props {
  lib: Library;
  rack?: RackTemplate;
  onAdd(deviceId: string, variantId?: string): void;
}

/**
 * Device palette as the Devices tree: Type (category) -> Item type -> Items (vendor products).
 * Only devices that fit the rack's unit system are listed. Drag an item type or an item onto the
 * elevation, or double-click to add it at the first free unit.
 */
export function DevicePalette({ lib, rack, onAdd }: Props) {
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const devices = lib.devices.items().filter((d) => !traitsOf(d.category).facility && (!rack || fitsRackUnits(d, rack)));
  const items: SidebarItem[] = devices.map((d) => ({
    id: d.id, name: d.name, path: [categoryFolder(d.category)], order: deviceSortKey(d),
    keywords: `${d.category} ${lib.variants.of(d.id).map((v) => variantLabel(v)).join(' ')}`,
    badge: isRepeatable(d) ? `${formatHeight(d.height)} ×n` : formatHeight(d.height),
  })).filter((i) => matchesFilter(i, q));
  const hidden = lib.devices.items().filter((d) => !traitsOf(d.category).facility).length - devices.length;
  const toggle = (set: Set<string>, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); return n; };

  const Row = ({ d, depth }: { d: DeviceDefinition; depth: number }) => {
    const variants = lib.variants.of(d.id);
    const def = lib.variants.defaultOf(d.id);
    const expanded = open.has(d.id) || (!!q && variants.some((v) => variantLabel(v).toLowerCase().includes(q.toLowerCase())));
    return (
      <>
        <div className="palette-item" style={{ paddingLeft: 12 + depth * 12 }} draggable
          onDragStart={(e) => e.dataTransfer.setData(DEVICE_DRAG_TYPE, d.id)}
          onDoubleClick={() => onAdd(d.id)}
          title="Drag onto the rack, or double-click to add (default item)">
          {variants.length > 1
            ? <span className="caret" onClick={(e) => { e.stopPropagation(); setOpen(toggle(open, d.id)); }}>{expanded ? '▾' : '▸'}</span>
            : <span className="caret" />}
          <span className="swatch" style={{ background: categoryStyle(d.category).fill, border: `1px solid ${categoryStyle(d.category).stroke}` }} />
          <span className="sidebar-item-name">{d.name}</span>
          <span className="badge">{isRepeatable(d) ? `${formatHeight(d.height)} ×n` : formatHeight(d.height)}</span>
        </div>
        {expanded && variants.map((v) => (
          <div key={v.id} className="palette-item sidebar-subitem" style={{ paddingLeft: 12 + depth * 12 + 36 }} draggable
            onDragStart={(e) => e.dataTransfer.setData(DEVICE_DRAG_TYPE, `${d.id}|${v.id}`)}
            onDoubleClick={() => onAdd(d.id, v.id)}
            title="Drag onto the rack, or double-click to add this item">
            <span className="sidebar-item-name">{variantLabel(v) || v.id}</span>
            {v.id === def?.id && <span className="badge">default</span>}
          </div>
        ))}
      </>
    );
  };

  const Tree = ({ node, depth }: { node: TreeNode; depth: number }) => (
    <>
      {node.folders.map((f) => {
        const isOpen = !!q || !closed.has(f.key);
        return (
          <div key={f.key}>
            <div className="tree-folder" style={{ paddingLeft: 12 + depth * 12 }} onClick={() => setClosed(toggle(closed, f.key))}>
              <span className="caret">{isOpen ? '▾' : '▸'}</span>
              <span className="sidebar-item-name">{f.label}</span>
              <span className="badge">{f.items.length}</span>
            </div>
            {isOpen && <Tree node={f} depth={depth + 1} />}
          </div>
        );
      })}
      {node.items.map((i) => {
        const d = lib.devices.get(i.id);
        return d ? <Row key={i.id} d={d} depth={depth} /> : null;
      })}
    </>
  );

  return (
    <div className="palette">
      <div className="sidebar-group-title">Device palette</div>
      <input placeholder="Filter devices…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="palette-list">
        <Tree node={buildTree(items)} depth={0} />
      </div>
      {rack && hidden > 0 && <p className="muted pad">{`${hidden} device(s) for other unit systems hidden (${rack.unitSystem} rack).`}</p>}
    </div>
  );
}
