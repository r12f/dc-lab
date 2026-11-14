export interface SidebarItem {
  id: string;
  name: string;
  /** Tree path of folders, e.g. ["Generic", "Switch"]. */
  path: string[];
  badge?: string;
  /** Extra text matched by the filter (vendor, model, id…). */
  keywords?: string;
  /** Sort keys per path level (parallel to `path`); folders without one sort by label. */
  pathOrder?: (number | string)[];
  /** Sort key among siblings; defaults to the name. */
  order?: number | string;
  /** Selectable sub-items shown under this item when it is expanded (e.g. vendor items of an item type). */
  children?: SidebarItem[];
}

type SortKey = number | string;

export interface TreeNode {
  key: string;
  label: string;
  order?: SortKey;
  folders: TreeNode[];
  items: SidebarItem[];
}

/** Numbers before strings; numbers ascending, strings by locale. */
function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return a.localeCompare(b);
}

/** Builds a folder tree from item paths; folders and items sort by their order key, else by label. */
export function buildTree(items: SidebarItem[]): TreeNode {
  const root: TreeNode = { key: '', label: '', folders: [], items: [] };
  for (const item of items) {
    let node = root;
    for (const [i, part] of item.path.entries()) {
      let next = node.folders.find((f) => f.label === part);
      if (!next) {
        next = { key: `${node.key}/${part}`, label: part, order: item.pathOrder?.[i], folders: [], items: [] };
        node.folders.push(next);
      }
      node = next;
    }
    node.items.push(item);
  }
  const sort = (n: TreeNode) => {
    n.folders.sort((a, b) => compareKeys(a.order ?? a.label, b.order ?? b.label) || a.label.localeCompare(b.label));
    n.items.sort((a, b) => compareKeys(a.order ?? a.name, b.order ?? b.name) || a.name.localeCompare(b.name));
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
  return terms.every((t) => hay.includes(t)) || (item.children ?? []).some((c) => matchesFilter({ ...c, path: item.path }, filter));
}

