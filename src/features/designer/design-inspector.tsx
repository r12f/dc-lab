import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { Tabs } from '../../ui/tabs';
import { TextField } from '../../ui/fields';
import { ABBR_MAX, abbrProblem } from '../../domain/design/abbr';
import type { DesignEditor } from './use-design-editor';
import { PlacementPanel } from './placement-panel';
import { CablesPanel } from './cables-panel';
import { RackSummaryPanel } from './rack-summary-panel';

export type InspectorTab = 'placement' | 'cables' | 'summary';

interface Props {
  lib: Library;
  design: RackDesign;
  editor: DesignEditor;
  placementId?: string;
  onSelectPlacement(id: string | undefined): void;
  tab: InspectorTab;
  onTabChange(tab: InspectorTab): void;
  cableId?: string;
  onSelectCable(id: string | undefined): void;
}

export function DesignInspector({ lib, design, editor, placementId, onSelectPlacement, tab, onTabChange, cableId, onSelectCable }: Props) {
  const placement = design.placements.find((p) => p.id === placementId);
  return (
    <div className="inspector-inner">
      <div className="row2">
        <TextField label="Design name" value={design.name} onChange={editor.rename} />
        <TextField label={`Abbreviation (≤ ${ABBR_MAX})`} value={design.abbr} onChange={editor.setAbbr} />
      </div>
      {abbrProblem(design.abbr) && <p className="error">{abbrProblem(design.abbr)}</p>}
      <Tabs<InspectorTab>
        tabs={[{ id: 'summary', label: 'BOM & metrics' }, { id: 'placement', label: 'Device' }, { id: 'cables', label: `Cables (${design.cables.length})` }]}
        value={tab}
        onChange={onTabChange}
      />
      {tab === 'summary' && <RackSummaryPanel lib={lib} design={design} />}
      {tab === 'placement' && (placement ? (
        <PlacementPanel lib={lib} placement={placement} templateId={design.templateId} editor={editor}
          onRemoved={() => onSelectPlacement(undefined)} />
      ) : <p className="muted">Select a device on the rack.</p>)}
      {tab === 'cables' && (
        <CablesPanel lib={lib} design={design} editor={editor} selectedId={cableId} onSelect={onSelectCable}
          startPlacementId={placementId} />
      )}
    </div>
  );
}
