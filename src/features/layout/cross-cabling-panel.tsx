import { useMemo, useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { CrossRackCable, CrossRackEnd, DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { applicableCrossCables, crossEndKey, crossRackLayout, planCrossCables, usedCrossEnds } from '../../domain/layout/cross-cables';
import { portName } from '../../domain/device/ports';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/button';
import { Section, SelectField } from '../../ui/fields';

export interface CrossSides { a?: string; b?: string }

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  /** Rack selected on the canvas (one), offered as A / B side. */
  selectedRackId?: string;
  sides: CrossSides;
  onSides(s: CrossSides): void;
  onChange(crossCables: CrossRackCable[]): void;
}

/**
 * Cross-rack cabling side bar: two columns, A side and B side, each listing a rack's cross-rack connectors laid out
 * like its cabling view (device by device, port groups in drawing order). Pick connectors on both sides, then a
 * cable that fits them, and Assign.
 */
export function CrossCablingPanel({ lib, designs, layout, selectedRackId, sides, onSides, onChange }: Props) {
  const [sel, setSel] = useState<{ a: CrossRackEnd[]; b: CrossRackEnd[] }>({ a: [], b: [] });
  const [mediaId, setMediaId] = useState('');
  const selected = layout.assignments.find((a) => a.id === selectedRackId);
  const used = useMemo(() => usedCrossEnds(layout), [layout]);
  const cables = applicableCrossCables(lib, designs, layout, sel.a, sel.b);
  const media = cables.some((m) => m.id === mediaId) ? mediaId : cables[0]?.id ?? '';
  const plan = sel.a.length && sel.b.length && media ? planCrossCables(lib, designs, layout, sel.a, sel.b, media) : undefined;
  const setSide = (side: 'a' | 'b') => {
    if (!selected) return;
    onSides({ ...sides, [side]: selected.id });
    setSel({ ...sel, [side]: [] });
  };
  const toggle = (side: 'a' | 'b', e: CrossRackEnd) => {
    const k = crossEndKey(e);
    const list = sel[side];
    setSel({ ...sel, [side]: list.some((x) => crossEndKey(x) === k) ? list.filter((x) => crossEndKey(x) !== k) : [...list, e] });
  };
  const assign = () => {
    if (!plan || plan.error) return;
    const existing = layout.crossCables ?? [];
    const ids = existing.map((c) => c.id);
    const added = plan.cables.map((c) => {
      const id = uniqueId('xc', ids);
      ids.push(id);
      return { id, ...c };
    });
    onChange([...existing, ...added]);
    setSel({ a: [], b: [] });
  };
  const remove = (ends: CrossRackEnd[]) => {
    const ids = new Set(ends.map((e) => used.get(crossEndKey(e))).filter(Boolean));
    onChange((layout.crossCables ?? []).filter((c) => !ids.has(c.id)));
    setSel({ a: [], b: [] });
  };
  const usedSel = [...sel.a, ...sel.b].filter((e) => used.has(crossEndKey(e)));
  return (
    <div className="inspector-inner">
      <Section title="Cross-rack cabling">
        <p className="muted">Select a rack on the plan and set it as A or B side; its cross-rack connectors are listed below. Pick connectors on both sides, then a cable.</p>
        <div className="row2">
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as A side` : 'Select a rack on the plan'} onClick={() => setSide('a')}>
            {`Set A${selected ? ` = ${selected.label}` : ''}`}
          </Button>
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as B side` : 'Select a rack on the plan'} onClick={() => setSide('b')}>
            {`Set B${selected ? ` = ${selected.label}` : ''}`}
          </Button>
        </div>
        <SelectField<string> label={`Cable (${cables.length} fit)`} value={media}
          options={cables.length ? cables.map((m) => ({ value: m.id, label: m.name })) : [{ value: '', label: 'No cable fits' }]}
          onChange={setMediaId} />
        {plan?.error && <p className="warn">{plan.error}</p>}
        <div className="row2">
          <Button variant="primary" disabled={!plan || !!plan.error} onClick={assign}>
            {`Assign${plan && !plan.error ? ` ${plan.cables.length} cable${plan.cables.length === 1 ? '' : 's'}` : ''}`}
          </Button>
          <Button variant="danger" disabled={!usedSel.length} title="Remove the cables on the selected connectors" onClick={() => remove(usedSel)}>
            Remove cables
          </Button>
        </div>
      </Section>
      <div className="cross-sides">
        {(['a', 'b'] as const).map((side) => (
          <SideColumn key={side} lib={lib} designs={designs} layout={layout} side={side} rackId={sides[side]}
            selected={sel[side]} used={used} onToggle={(e) => toggle(side, e)}
            onClear={() => setSel({ ...sel, [side]: [] })} />
        ))}
      </div>
    </div>
  );
}

function SideColumn({ lib, designs, layout, side, rackId, selected, used, onToggle, onClear }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; side: 'a' | 'b'; rackId?: string;
  selected: CrossRackEnd[]; used: Map<string, string>; onToggle(e: CrossRackEnd): void; onClear(): void;
}) {
  const rack = layout.assignments.find((a) => a.id === rackId);
  const design = rack && designs(rack.designId);
  const devices = useMemo(() => (design ? crossRackLayout(lib, design) : []), [lib, design]);
  const sel = new Set(selected.map(crossEndKey));
  return (
    <div className="cross-side">
      <div className="cross-side-head">
        <strong>{`${side.toUpperCase()} side`}</strong>
        <span className="muted">{rack ? `${rack.label} · ${design?.name ?? '?'}` : 'not set'}</span>
        {selected.length > 0 && <button type="button" className="link" onClick={onClear}>{`clear ${selected.length}`}</button>}
      </div>
      {rack && !devices.length && <p className="muted">No cross-rack connectors in this rack (mark them in the Rack Designer cabling view).</p>}
      {rack && devices.map((d) => (
        <div key={d.placement.id} className="cross-device">
          <div className="cross-device-name">{d.placement.label}</div>
          {d.groups.map(({ group, ports }) => (
            <div key={group.id} className="cross-group">
              <div className="muted">{group.label}</div>
              <div className="cross-ports">
                {[...ports.entries()].sort((x, y) => x[0] - y[0]).map(([index, legs]) => legs.map((c) => {
                  const e: CrossRackEnd = { assignmentId: rack.id, placementId: d.placement.id, portRef: `${group.id}/${index}`, connector: c };
                  const k = crossEndKey(e);
                  const name = `${portName(group, index)}${c && legs.length > 1 ? String.fromCharCode(64 + c) : ''}`;
                  return (
                    <button key={k} type="button" title={`${d.placement.label} ${name}${used.has(k) ? ' — cabled' : ''}`}
                      className={`cross-port${sel.has(k) ? ' selected' : ''}${used.has(k) ? ' used' : ''}`}
                      onClick={() => onToggle(e)}>{name}</button>
                  );
                }))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
