import { useEffect, useMemo, useRef, useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { CrossRackCable, CrossRackEnd, DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { applicableCrossCables, crossEndKey, crossRackLayout, planCrossCables, usedCrossEnds } from '../../domain/layout/cross-cables';
import { groupCols, portCell, portName } from '../../domain/device/ports';
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
  /** Selects (on) or deselects a connector; selection order is kept (it pairs A and B ends in order). */
  const mark = (side: 'a' | 'b', e: CrossRackEnd, on: boolean) => setSel((cur) => {
    const k = crossEndKey(e);
    const has = cur[side].some((x) => crossEndKey(x) === k);
    if (has === on) return cur;
    return { ...cur, [side]: on ? [...cur[side], e] : cur[side].filter((x) => crossEndKey(x) !== k) };
  });
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
        <div className="row3 cross-set">
          <Button disabled={!selected} title={selected ? `Set ${selected.label} as A side` : 'Select a rack on the plan'} onClick={() => setSide('a')}>
            {`Set A${selected ? ` = ${selected.label}` : ''}`}
          </Button>
          <Button disabled={!sides.a && !sides.b} title="Swap A and B sides (selected connectors swap with them)"
            onClick={() => { onSides({ a: sides.b, b: sides.a }); setSel({ a: sel.b, b: sel.a }); }}>⇄</Button>
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
            selected={sel[side]} used={used} onMark={(e, on) => mark(side, e, on)}
            onClear={() => setSel({ ...sel, [side]: [] })} />
        ))}
      </div>
    </div>
  );
}

function SideColumn({ lib, designs, layout, side, rackId, selected, used, onMark, onClear }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; side: 'a' | 'b'; rackId?: string;
  selected: CrossRackEnd[]; used: Map<string, string>; onMark(e: CrossRackEnd, on: boolean): void; onClear(): void;
}) {
  // Press on a connector and sweep over others: they all take the pressed connector's new state (select / deselect).
  const sweep = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const up = () => { sweep.current = undefined; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);
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
          {d.groups.map(({ group, ports }) => {
            // Same grid as the faceplate / cabling view (portCell: fill order, holes, bottom-up, mirrored);
            // ports without a cross-rack connector are blank cells so positions stay recognisable.
            const rows = Math.max(1, group.rows);
            const cols = groupCols(group, rows);
            const legsPer = Math.max(group.connectorsPerPort ?? 1, ...[...ports.values()].flat().map((c) => c ?? 1));
            const stacked = group.connectorLayout === 'stacked' && legsPer > 1;
            return (
              <div key={group.id} className="cross-group">
                <div className="muted">{group.label}</div>
                <div className="cross-grid" style={{ gridTemplateColumns: `repeat(${cols}, auto)`, gridTemplateRows: `repeat(${rows}, auto)` }}>
                  {Array.from({ length: group.count }, (_, i) => {
                    const index = i + 1;
                    const { col, row } = portCell(group, i, rows);
                    const marked = ports.get(index);
                    const name = portName(group, index);
                    const legs = Array.from({ length: legsPer }, (_, k) => (legsPer > 1 ? k + 1 : undefined));
                    return (
                      <div key={index} className={`cross-cell${stacked ? ' stacked' : ''}`} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                        {legs.map((c) => {
                          const label = `${name}${c ? String.fromCharCode(64 + c) : ''}`;
                          if (!marked?.includes(c)) return <span key={c ?? 0} className="cross-port blank" title={`${label} — not cross-rack`}>{label}</span>;
                          const e: CrossRackEnd = { assignmentId: rack.id, placementId: d.placement.id, portRef: `${group.id}/${index}`, connector: c };
                          const k = crossEndKey(e);
                          return (
                            <button key={k} type="button" title={`${d.placement.label} ${label}${used.has(k) ? ' — cabled' : ''}`}
                              className={`cross-port${sel.has(k) ? ' selected' : ''}${used.has(k) ? ' used' : ''}`}
                              onPointerDown={(ev) => {
                                if (ev.button !== 0) return;
                                ev.preventDefault();
                                // Release implicit (touch / pen) capture so pointerenter fires on the connectors swept over.
                                (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
                                sweep.current = !sel.has(k);
                                onMark(e, sweep.current);
                              }}
                              onPointerEnter={() => { if (sweep.current !== undefined) onMark(e, sweep.current); }}>{label}</button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
