export interface SidebarItem {
  id: string;
  name: string;
  /** Tree path of folders, e.g. ["Generic", "Switch"]. */
  path: string[];
  badge?: string;
  /** Extra text matched by the filter (vendor, model, id…). */
  keywords?: string;
}

export interface TreeNode {
  key: string;
  label: string;
  folders: TreeNode[];
  items: SidebarItem[];
}

/** Builds a folder tree from item paths; folders and items are sorted by label. */
export function buildTree(items: SidebarItem[]): TreeNode {
  const root: TreeNode = { key: '', label: '', folders: [], items: [] };
  for (const item of items) {
    let node = root;
    for (const part of item.path) {
      let next = node.folders.find((f) => f.label === part);
      if (!next) {
        next = { key: `${node.key}/${part}`, label: part, folders: [], items: [] };
        node.folders.push(next);
      }
      node = next;
    }
    node.items.push(item);
  }
  const sort = (n: TreeNode) => {
    n.folders.sort((a, b) => a.label.localeCompare(b.label));
    n.items.sort((a, b) => a.name.localeCompare(b.name));
    n.folders.forEach(sort);
  };
  sort(root);
  return root;
}

export function countItems(node: TreeNode): number {
  return node.items.length + node.folders.reduce((n, f) => n + countItems(f), 0);
}

/** Case-insensitive match of every whitespace-separated term against name, path and keywords. */
export function matchesFilter(item: SidebarItem, filter: string): boolean {
  const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = [item.name, ...item.path, item.keywords ?? '', item.id].join(' ').toLowerCase();
  return terms.every((t) => hay.includes(t));
}
