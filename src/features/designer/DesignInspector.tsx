import { useState } from 'react';
import type { Library } from '../../domain/library/Library';
import type { RackDesign } from '../../domain/design/types';
import { Tabs } from '../../ui/Tabs';
import { TextField } from '../../ui/fields';
import type { DesignEditor } from './useDesignEditor';
import { PlacementPanel } from './PlacementPanel';
import { CablesPanel } from './CablesPanel';
import { RackSummaryPanel } from './RackSummaryPanel';

type Tab = 'placement' | 'cables' | 'summary';

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  placementId?: string;
  onSelectPlacement(id: string | undefined): void;
}

export function DesignInspector({ lib, design, editor, placementId, onSelectPlacement }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const placement = design.placements.find((p) => p.id === placementId);
  return (
    <div className="inspector-inner">
      <TextField label="Design name" value={design.name} onChange={editor.rename} />
      <Tabs<Tab>
        tabs={[{ id: 'summary', label: 'BOM & metrics' }, { id: 'placement', label: 'Device' }, { id: 'cables', label: 'Cables' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'summary' && <RackSummaryPanel lib={lib} design={design} />}
      {tab === 'placement' && (placement ? (
        <PlacementPanel lib={lib} placement={placement} templateId={design.templateId} editor={editor}
          onRemoved={() => onSelectPlacement(undefined)} />
      ) : <p className="muted">Select a device on the rack.</p>)}
      {tab === 'cables' && <CablesPanel lib={lib} design={design} editor={editor} />}
    </div>
  );
}
