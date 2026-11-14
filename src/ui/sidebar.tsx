import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { buildTree, countItems, matchesFilter, type SidebarItem, type TreeNode } from './sidebar-tree';

export type { SidebarItem } from './sidebar-tree';

interface Props {
  title: string;
  items: SidebarItem[];
  selectedId?: string;
  onSelect(id: string): void;
  onNew?(): void;
  onDuplicate?(id: string): void;
  onDelete?(id: string): void;
  /** Rendered under the title (forms, palettes). */
  header?: ReactNode;
  /** Rendered under the action bar. */
  footer?: ReactNode;
  emptyText?: string;
  filterable?: boolean;
}

interface TreeProps {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  collapsed: Set<string>;
  /** Items whose children are shown. */
  expanded: Set<string>;
  forceOpen: boolean;
  onToggle(key: string): void;
  onExpand(id: string): void;
  onSelect(id: string): void;
}

function ItemRow({ item, depth, selectedId, open, onExpand, onSelect }: {
  item: SidebarItem; depth: number; selectedId?: string; open: boolean; onExpand(id: string): void; onSelect(id: string): void;
}) {
  const kids = item.children ?? [];
  const pad = 12 + depth * 12;
  return (
    <>
      <div className={`sidebar-item ${item.id === selectedId ? 'active' : ''}`} style={{ paddingLeft: pad }} onClick={() => onSelect(item.id)}>
        {kids.length > 0
          ? <span className="caret" onClick={(e) => { e.stopPropagation(); onExpand(item.id); }}>{open ? '▾' : '▸'}</span>
          : <span className="caret" />}
        <span className="sidebar-item-name">{item.name}</span>
        {item.badge && <span className="badge">{item.badge}</span>}
      </div>
      {open && kids.map((c) => (
        <div key={c.id} className={`sidebar-item sidebar-subitem ${c.id === selectedId ? 'active' : ''}`}
          style={{ paddingLeft: pad + 26 }} onClick={() => onSelect(c.id)}>
          <span className="sidebar-item-name">{c.name}</span>
          {c.badge && <span className="badge">{c.badge}</span>}
        </div>
      ))}
    </>
  );
}

function Tree({ node, depth, selectedId, collapsed, expanded, forceOpen, onToggle, onExpand, onSelect }: TreeProps) {
  const indent = { paddingLeft: 12 + depth * 12 };
  return (
    <>
      {node.folders.map((f) => {
        const open = forceOpen || !collapsed.has(f.key);
        return (
          <div key={f.key}>
            <div className="tree-folder" style={indent} onClick={() => onToggle(f.key)}>
              <span className="caret">{open ? '▾' : '▸'}</span>
              <span className="sidebar-item-name">{f.label}</span>
              <span className="badge">{countItems(f)}</span>
            </div>
            {open && <Tree {...{ node: f, depth: depth + 1, selectedId, collapsed, expanded, forceOpen, onToggle, onExpand, onSelect }} />}
          </div>
        );
      })}
      {node.items.map((i) => (
        <ItemRow key={i.id} item={i} depth={depth} selectedId={selectedId} onExpand={onExpand} onSelect={onSelect}
          open={forceOpen || expanded.has(i.id) || (!!selectedId && i.children?.some((c) => c.id === selectedId)) || false} />
      ))}
    </>
  );
}

/** Filterable, collapsible tree of items with New / Duplicate / Delete actions. */
export function Sidebar(props: Props) {
  const { title, items, selectedId, onSelect, onNew, onDuplicate, onDelete, header, footer, emptyText, filterable } = props;
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => matchesFilter(i, filter));
  const selected = items.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.id === selectedId);
  const expand = (id: string) => setExpanded((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="sidebar-inner">
      <div className="sidebar-head">
        <h2>{title}</h2>
        {onNew && <Button variant="primary" onClick={onNew}>+ New</Button>}
      </div>
      {header}
      {filterable && (
        <div className="sidebar-filter">
          <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      )}
      <div className="sidebar-list">
        {visible.length === 0 && <p className="muted pad">{items.length ? 'No matches.' : emptyText ?? 'Nothing here yet.'}</p>}
        <Tree node={buildTree(visible)} depth={0} selectedId={selectedId} collapsed={collapsed} expanded={expanded}
          forceOpen={!!filter} onToggle={toggle} onExpand={expand} onSelect={onSelect} />
      </div>
      {selected && (onDuplicate || onDelete) && (
        <div className="sidebar-actions">
          {onDuplicate && <Button onClick={() => onDuplicate(selected.id)}>Duplicate</Button>}
          {onDelete && (
            <Button variant="danger" onClick={() => confirm(`Delete "${selected.name}"?`) && onDelete(selected.id)}>Delete</Button>
          )}
        </div>
      )}
      {footer}
    </div>
  );
}
