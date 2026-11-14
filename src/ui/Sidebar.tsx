import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { buildTree, countItems, matchesFilter, type SidebarItem, type TreeNode } from './sidebarTree';

export type { SidebarItem } from './sidebarTree';

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
  forceOpen: boolean;
  onToggle(key: string): void;
  onSelect(id: string): void;
}

function Tree({ node, depth, selectedId, collapsed, forceOpen, onToggle, onSelect }: TreeProps) {
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
            {open && <Tree {...{ node: f, depth: depth + 1, selectedId, collapsed, forceOpen, onToggle, onSelect }} />}
          </div>
        );
      })}
      {node.items.map((i) => (
        <div key={i.id} className={`sidebar-item ${i.id === selectedId ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 12 + 14 }} onClick={() => onSelect(i.id)}>
          <span className="sidebar-item-name">{i.name}</span>
          {i.badge && <span className="badge">{i.badge}</span>}
        </div>
      ))}
    </>
  );
}

/** Filterable, collapsible tree of items with New / Duplicate / Delete actions. */
export function Sidebar(props: Props) {
  const { title, items, selectedId, onSelect, onNew, onDuplicate, onDelete, header, footer, emptyText, filterable } = props;
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => matchesFilter(i, filter));
  const selected = items.find((i) => i.id === selectedId);
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
        <Tree node={buildTree(visible)} depth={0} selectedId={selectedId} collapsed={collapsed}
          forceOpen={!!filter} onToggle={toggle} onSelect={onSelect} />
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
