import type { CatalogItem } from '../../domain/catalogItem';
import { newCable, newOptic } from '../../domain/optics/factory';
import type { OpticsCatalog } from './catalogRef';

interface Choice {
  label: string;
  description: string;
  catalog: OpticsCatalog;
  baseId: string;
  build(id: string): CatalogItem;
}

const CHOICES: Choice[] = [
  { label: 'Optic module', description: 'Pluggable transceiver, DAC/AOC end or laser source', catalog: 'optic', baseId: 'new-optic', build: (id) => newOptic(id, 'module') },
  { label: 'Pigtail optic', description: 'Optic with permanently attached fiber legs', catalog: 'optic', baseId: 'new-pigtail-optic', build: (id) => newOptic(id, 'pigtail') },
  { label: 'Cable', description: 'Fiber, DAC, AOC, copper or power cable media', catalog: 'cable', baseId: 'new-cable', build: newCable },
];

/** Picker opened by "+ New". */
export function NewOpticsMenu({ onPick, onClose }: { onPick(c: Choice): void; onClose(): void }) {
  return (
    <div className="menu" onMouseLeave={onClose}>
      {CHOICES.map((c) => (
        <div key={c.label} className="menu-item" onClick={() => { onPick(c); onClose(); }}>
          {c.label}
          <small>{c.description}</small>
        </div>
      ))}
    </div>
  );
}
