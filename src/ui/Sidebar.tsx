import type { ReactNode } from 'react';
import { Button } from './Button';

export interface SidebarItem {
  id: string;
  name: string;
  group: string;
  badge?: string;
  readOnly?: boolean;
}

interface Props {
  title: string;
  items: SidebarItem[];
  selectedId?: string;
  onSelect(id: string): void;
  onNew?(): void;
  onDuplicate?(id: string): void;
  onDelete?(id: string): void;
  header?: ReactNode;
  emptyText?: string;
}

function groupBy(items: SidebarItem[]): [string, SidebarItem[]][] {
  const map = new Map<string, SidebarItem[]>();
  for (const i of items) map.set(i.group, [...(map.get(i.group) ?? []), i]);
  return [...map.entries()];
}

/** Grouped item list with New / Duplicate / Delete actions. */
export function Sidebar({ title, items, selectedId, onSelect, onNew, onDuplicate, onDelete, header, emptyText }: Props) {
  const selected = items.find((i) => i.id === selectedId);
  return (
    <div className="sidebar-inner">
      <div className="sidebar-head">
        <h2>{title}</h2>
        {onNew && <Button variant="primary" onClick={onNew}>+ New</Button>}
      </div>
      {header}
      <div className="sidebar-list">
        {items.length === 0 && <p className="muted">{emptyText ?? 'Nothing here yet.'}</p>}
        {groupBy(items).map(([group, list]) => (
          <div key={group} className="sidebar-group">
            <div className="sidebar-group-title">{group}</div>
            {list.map((i) => (
              <div
                key={i.id}
                className={`sidebar-item ${i.id === selectedId ? 'active' : ''}`}
                onClick={() => onSelect(i.id)}
              >
                <span className="sidebar-item-name">{i.name}</span>
                {i.badge && <span className="badge">{i.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      {selected && (onDuplicate || onDelete) && (
        <div className="sidebar-actions">
          {onDuplicate && <Button onClick={() => onDuplicate(selected.id)}>Duplicate</Button>}
          {onDelete && !selected.readOnly && (
            <Button variant="danger" onClick={() => onDelete(selected.id)}>Delete</Button>
          )}
        </div>
      )}
    </div>
  );
}
