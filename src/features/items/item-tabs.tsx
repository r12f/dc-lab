import { useState, type ReactNode } from 'react';
import { Tabs } from '../../ui/tabs';

interface Props {
  /** Item editor (an item is open) or the item list. */
  items: ReactNode;
  itemCount: number;
  /** An item (not the item type) is selected: the Items tab is shown. */
  itemSelected: boolean;
  /** Back to the item type (deselects the item). */
  onLeaveItem(): void;
  /** The item type editor. */
  children: ReactNode;
}

/** Inspector with an "Item type" tab and a separate "Items (n)" tab (Devices, Optics & Cables). */
export function ItemTabs({ items, itemCount, itemSelected, onLeaveItem, children }: Props) {
  const [tab, setTab] = useState<'type' | 'items'>('type');
  // Opening an item (from the sidebar or the list) shows the Items tab.
  const showItems = tab === 'items' || itemSelected;
  return (
    <div className="inspector-inner">
      <Tabs<'type' | 'items'> tabs={[{ id: 'type', label: 'Item type' }, { id: 'items', label: `Items (${itemCount})` }]}
        value={showItems ? 'items' : 'type'} onChange={(t) => { setTab(t); if (t === 'type') onLeaveItem(); }} />
      {showItems ? items : children}
    </div>
  );
}
