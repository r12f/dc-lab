import type { ItemTarget } from '../../domain/items/types';
import type { Library } from '../../domain/library/library';
import { variantLabel } from '../../domain/items/variants';
import { Button } from '../../ui/button';
import { Section } from '../../ui/fields';
import type { ItemVariantCommands } from './use-item-variants';

interface Props {
  lib: Library;
  target: ItemTarget;
  itemId: string;
  commands: ItemVariantCommands;
  onSelect(variantId: string): void;
}

/** Items (vendor products) of an item type, with "+ Item". Shown at the top of the item type inspector. */
export function ItemsSection({ lib, target, itemId, commands, onSelect }: Props) {
  const def = lib.variants.defaultOf(itemId);
  const items = lib.variants.of(itemId);
  return (
    <Section title={`Items (${items.length})`} actions={<Button onClick={() => onSelect(commands.add(target, itemId))}>+ Item</Button>}>
      {items.length === 0 && <p className="muted">No items. Add a vendor product with “+ Item”.</p>}
      {items.map((v) => (
        <div key={v.id} className="sidebar-item" onClick={() => onSelect(v.id)}>
          <span className="sidebar-item-name">{variantLabel(v) || '(no vendor / model)'}</span>
          {v.specs && <span className="badge" title="Overrides power / weight">{[v.specs.typicalW !== undefined && `${v.specs.typicalW} W`, v.specs.weightKg !== undefined && `${v.specs.weightKg} kg`].filter(Boolean).join(' · ') || 'specs'}</span>}
          {v.id === def?.id && <span className="badge">default</span>}
          <Button className="btn-icon" variant="danger" disabled={!commands.canDelete(v)}
            title={commands.canDelete(v) ? `Delete ${variantLabel(v) || 'item'}` : 'Built-in items cannot be deleted'}
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete item "${variantLabel(v) || v.id}"?`)) commands.del(v); }}>✕</Button>
        </div>
      ))}
    </Section>
  );
}
