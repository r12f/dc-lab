import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { Splitter } from './splitter';
import { DEFAULT_SIDEBAR_LIST_HEIGHT, usePreferences } from '../state/preferences';
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
  /** False for items that cannot be deleted (built-ins); the delete button is disabled with the reason. */
  canDelete?(id: string): boolean;
  /** Rendered under the title (forms, palettes). */
  header?: ReactNode;
  /** Rendered under the action bar. */
  footer?: ReactNode;
  /** Lower pane under the item list (e.g. the device palette); the list/pane boundary is draggable. */
  lower?: ReactNode;
  emptyText?: string;
  filterable?: boolean;
  /** Folders start collapsed (folders holding the selected item still open). */
  defaultCollapsed?: boolean;
}

interface TreeProps {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  /** Explicit open/closed overrides for folder keys. */
  folderOpen: ReadonlyMap<string, boolean>;
  defaultCollapsed: boolean;
  /** Folder keys on the path to the selected item. */
  selectedPath: ReadonlySet<string>;
  /** Items whose children are shown. */
  expanded: ReadonlySet<string>;
  forceOpen: boolean;
  onToggle(key: string, currentlyOpen: boolean): void;
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

function Tree(props: TreeProps) {
  const { node, depth, selectedId, folderOpen, defaultCollapsed, selectedPath, expanded, forceOpen, onExpand, onSelect } = props;
  const indent = { paddingLeft: 12 + depth * 12 };
  return (
    <>
      {node.folders.map((f) => {
        const base = defaultCollapsed ? selectedPath.has(f.key) : true;
        const open = forceOpen || (folderOpen.get(f.key) ?? base);
        return (
          <div key={f.key}>
            <div className="tree-folder" style={indent} onClick={() => props.onToggle(f.key, open)}>
              <span className="caret">{open ? '▾' : '▸'}</span>
              <span className="sidebar-item-name">{f.label}</span>
              <span className="badge">{countItems(f)}</span>
            </div>
            {open && <Tree {...props} node={f} depth={depth + 1} />}
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

/** Two stacked chevrons: pointing apart = expand all, pointing together = collapse all. */
function ChevronsIcon({ out = false }: { out?: boolean }) {
  const d = out ? 'M4 6l4-3 4 3M4 10l4 3 4-3' : 'M4 3l4 3 4-3M4 13l4-3 4 3';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d={d} />
    </svg>
  );
}

/** Filterable, collapsible tree of items with New / Duplicate / Delete actions. */
export function Sidebar(props: Props) {
  const { title, items, selectedId, onSelect, onNew, onDuplicate, onDelete, canDelete, header, footer, emptyText, filterable, lower, defaultCollapsed = false } = props;
  const listHeight = usePreferences((s) => s.sidebarListHeight);
  const setListHeight = usePreferences((s) => s.setSidebarListHeight);
  const [filter, setFilter] = useState('');
  const [folderOpen, setFolderOpen] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const visible = items.filter((i) => matchesFilter(i, filter));
  const selected = items.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.id === selectedId);
  const selectedOwner = items.find((i) => i.id === selectedId || i.children?.some((c) => c.id === selectedId));
  const selectedPathKeys = (selectedOwner?.path ?? []).map((_, n, p) => `/${p.slice(0, n + 1).join('/')}`);
  const selectedPath = new Set(selectedPathKeys);

  const selectionSig = `${selectedId ?? ''}\u0000${selectedPathKeys.join('\u0000')}`;
  const [prevSelectionSig, setPrevSelectionSig] = useState(selectionSig);
  let activeFolderOpen = folderOpen;
  if (prevSelectionSig !== selectionSig) {
    setPrevSelectionSig(selectionSig);
    if (selectedId !== undefined && selectedPathKeys.some((k) => folderOpen.get(k) === false)) {
      const next = new Map(folderOpen);
      for (const k of selectedPathKeys) {
        if (next.get(k) === false) next.delete(k);
      }
      activeFolderOpen = next;
      setFolderOpen(next);
    }
  }

  const expand = (id: string) => setExpanded((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggle = (key: string, currentlyOpen: boolean) =>
    setFolderOpen((c) => {
      const next = new Map(c);
      next.set(key, !currentlyOpen);
      return next;
    });

  const tree = buildTree(visible);
  const allFolderKeys = new Set<string>();
  for (const item of items) {
    for (let n = 0; n < item.path.length; n += 1) {
      allFolderKeys.add(`/${item.path.slice(0, n + 1).join('/')}`);
    }
  }
  /** Explicitly opens (or closes) every folder in the sidebar. */
  const setAll = (open: boolean) => {
    setFolderOpen(new Map([...allFolderKeys].map((k) => [k, open])));
    if (!open) setExpanded(new Set());
  };

  return (
    <div className="sidebar-inner">
      <div className="sidebar-head">
        <h2>{title}</h2>
        <div className="sidebar-head-actions">
          {onNew && <Button variant="primary" onClick={onNew}>+ New</Button>}
          {onDuplicate && (
            <Button className="btn-icon" title={selected ? `Duplicate "${selected.name}"` : 'Duplicate (select an item)'} aria-label="Duplicate"
              disabled={!selected} onClick={() => selected && onDuplicate(selected.id)}>⧉</Button>
          )}
          {onDelete && (
            <Button className="btn-icon" variant="danger" aria-label="Delete"
              title={!selected ? 'Delete (select an item)' : canDelete && !canDelete(selected.id) ? 'Built-in items cannot be deleted' : `Delete "${selected.name}"`}
              disabled={!selected || (!!canDelete && !canDelete(selected.id))}
              onClick={() => selected && confirm(`Delete "${selected.name}"?`) && onDelete(selected.id)}>✕</Button>
          )}
        </div>
      </div>
      {header}
      {(() => {
        const list = (
          <>
            {filterable && (
              <div className="sidebar-filter">
                <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <Button className="btn-icon" title="Expand all" aria-label="Expand all" onClick={() => setAll(true)}><ChevronsIcon out /></Button>
                <Button className="btn-icon" title="Collapse all" aria-label="Collapse all" onClick={() => setAll(false)}><ChevronsIcon /></Button>
              </div>
            )}
            <div className="sidebar-list">
              {visible.length === 0 && <p className="muted pad">{items.length ? 'No matches.' : emptyText ?? 'Nothing here yet.'}</p>}
              <Tree node={tree} depth={0} selectedId={selectedId} folderOpen={activeFolderOpen} defaultCollapsed={defaultCollapsed}
                selectedPath={selectedPath} expanded={expanded} forceOpen={!!filter} onToggle={toggle} onExpand={expand} onSelect={onSelect} />
            </div>
          </>
        );
        if (!lower) return list;
        return (
          <>
            <div className="sidebar-split-top" style={{ height: listHeight }}>{list}</div>
            <Splitter orientation="horizontal" label="List height" width={listHeight} direction={1}
              onResize={setListHeight} onReset={() => setListHeight(DEFAULT_SIDEBAR_LIST_HEIGHT)} />
            <div className="sidebar-split-bottom">{lower}</div>
          </>
        );
      })()}
      {footer}
    </div>
  );
}
