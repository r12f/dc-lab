import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import type { Library } from '../../domain/library/library';
import { parseInlineYaml, type YamlValue } from '../../domain/topo/yaml';
import { flowYaml, type YamlPath } from '../../domain/topo/yaml-edit';
import { deleteGroup, deleteLink, linksOfGroup, renameGroup, renamePool, setGroupField, setLinkField, topoDoc } from '../../domain/topo/edit';
import type { GroupHardware } from '../../domain/topo/hardware';
import type { VirtualTopo } from '../../domain/topo/virtual';
import { Button } from '../../ui/button';
import { Field, Section } from '../../ui/fields';

/** What the panel edits: a device set group (by name) or a link spec (by its index in the file's `topo` list). */
export type TopoSelection = { kind: 'group'; name: string } | { kind: 'link'; index: number };

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
/** A value as the panel shows it: scalars as written, collections inline (`[a, b]`). */
const text = (v: YamlValue | undefined) => (v === undefined || v === null ? '' : typeof v === 'object' ? flowYaml(v) : String(v));
/** A group, pool or partition name the file can use as a plain key. */
const NAME = /^[A-Za-z_][\w-]*$/;
const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined);
/** A pool as typed: `[a, b]` is a list of entries (slots), anything else one pattern. */
const poolValue = (s: string): YamlValue | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  if (!t.startsWith('[')) return t;
  try { const v = parseInlineYaml(t); return Array.isArray(v) ? v : undefined; } catch { return undefined; }
};
/** `1: 54, 2: 18` <-> { "1": 54, "2": 18 }. */
const sizesText = (o: Obj) => Object.entries(o).map(([k, v]) => `${k}: ${text(v)}`).join(', ');
const parseSizes = (s: string): Obj | undefined => {
  const out: Obj = {};
  for (const part of s.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^([^:]+):\s*(\d+)$/.exec(part);
    if (!m) return undefined;
    out[m[1].trim()] = Number(m[2]);
  }
  return Object.keys(out).length ? out : undefined;
};

interface DraftProps {
  value: string;
  label: string;
  /** Called with the text when it changed and `accept` takes it; otherwise the field shows the value again. */
  onCommit(v: string): void;
  accept?(v: string): boolean;
  placeholder?: string;
  title?: string;
  style?: CSSProperties;
}

/** A text input that commits on Enter or leaving the field (Esc puts the value back), so typing is not an edit. */
function Draft({ value, label, onCommit, accept, placeholder, title, style }: DraftProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft === value) return;
    if (accept && !accept(draft)) { setDraft(value); return; }
    onCommit(draft);
  };
  return (
    <input aria-label={label} title={title ?? label} placeholder={placeholder} value={draft} style={style}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') setDraft(value);
      }} />
  );
}

interface Props {
  lib: Library;
  /** The file as it is now (edits apply to it). */
  source: string;
  virtual: VirtualTopo;
  hardware: Map<string, GroupHardware>;
  selection?: TopoSelection;
  onSelect(sel: TopoSelection | undefined): void;
  /** The edited file; `renamed` when a group got a new name (the view and selection follow it). */
  onSource(source: string, renamed?: { from: string; to: string }): void;
}

/**
 * Sidebar panel under the topology list: the properties of the block or link selected in the diagram, edited in
 * place in the file (only the lines they sit on change).
 */
export function TopoInspector(props: Props) {
  const { source, selection } = props;
  let doc: Obj | undefined;
  try { doc = topoDoc(source); } catch { doc = undefined; }
  if (!doc) return <div className="topo-insp"><p className="muted">Fix the YAML problems to edit here.</p></div>;
  if (!selection) return <div className="topo-insp"><p className="muted">Select a block or a link in the diagram to edit it here.</p></div>;
  if (selection.kind === 'group') {
    const g = isObj(doc.device_set_groups) ? doc.device_set_groups[selection.name] : undefined;
    if (!isObj(g)) return <div className="topo-insp"><p className="muted">{`No device set group "${selection.name}".`}</p></div>;
    return <GroupPanel {...props} doc={doc} name={selection.name} g={g} />;
  }
  const t = Array.isArray(doc.topo) ? doc.topo[selection.index] : undefined;
  if (!isObj(t)) return <div className="topo-insp"><p className="muted">No such link.</p></div>;
  return <LinkPanel {...props} doc={doc} index={selection.index} t={t} />;
}

function Head({ title, onDelete, what }: { title: string; onDelete(): void; what: string }) {
  return (
    <div className="topo-insp-head">
      <h3>{title}</h3>
      <Button variant="danger" title={`Delete ${what}`} onClick={onDelete}>Delete</Button>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick(): void }) {
  return <Button className="btn-icon" variant="danger" aria-label={label} title={label} onClick={onClick}>✕</Button>;
}

function GroupPanel({ lib, source, virtual, hardware, onSource, onSelect, doc, name, g }: Props & { doc: Obj; name: string; g: Obj }) {
  const set = (path: YamlPath, v: YamlValue | undefined) => onSource(setGroupField(source, name, path, v));
  const groups = Object.keys(isObj(doc.device_set_groups) ? doc.device_set_groups : {});
  const free = (n: string) => NAME.test(n) && !groups.includes(n);
  const partitions = Array.isArray(g.partitions) ? g.partitions : [];
  const portMap = Array.isArray(g.port_map) ? g.port_map : [];
  const pools = isObj(g.ports) ? g.ports : {};
  const deviceType = typeof g.device_type === 'string' ? g.device_type : '';
  const device = lib.devices.get(deviceType || undefined);
  const vg = virtual.groups.find((x) => x.name === name);
  const devices = lib.devices.items().slice().sort((a, b) => a.name.localeCompare(b.name));
  const firstPorts = device?.ports.find((p) => p.count > 1) ?? device?.ports[0];
  const remove = () => {
    const n = linksOfGroup(source, name).length;
    if (!confirm(`Delete group ${name}${n ? ` and the ${n} link${n > 1 ? 's' : ''} using it` : ''}?`)) return;
    onSource(deleteGroup(source, name));
    onSelect(undefined);
  };
  const newKey = (base: string, taken: string[]) => { let i = 1; while (taken.includes(`${base}${i}`)) i++; return `${base}${i}`; };
  return (
    <div className="topo-insp">
      <Head title="Device set group" what={`group ${name}`} onDelete={remove} />
      <Field label="Name">
        <Draft value={name} label="Group name" accept={free}
          onCommit={(to) => { onSource(renameGroup(source, name, to), { from: name, to }); }} />
      </Field>
      <div className="row2">
        <Field label="Role"><Draft value={text(g.role)} label="Role" accept={(v) => !!v.trim()} onCommit={(v) => set(['role'], v.trim())} /></Field>
        <Field label="Count"><Draft value={text(g.count)} label="Count" accept={(v) => int(v) !== undefined} onCommit={(v) => set(['count'], int(v)!)} /></Field>
      </div>
      <Field label="Device type">
        <select aria-label="Device type" value={deviceType} onChange={(e) => set(['device_type'], e.target.value || undefined)}>
          <option value="">none</option>
          {deviceType && !device && <option value={deviceType}>{`${deviceType} (not in Devices)`}</option>}
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {device && (
        <p className="muted topo-insp-note">
          {`Breakout profile: ${hardware.get(name)?.profile?.name ?? 'none fits the ports'} (matched to the port pools)`}
        </p>
      )}

      <Section title="Partitions" actions={
        <Button className="btn-icon" aria-label="Add partition" title="Add partition"
          onClick={() => set(['partitions', partitions.length], { key: newKey('part', partitions.map((p) => (isObj(p) ? text(p.key) : ''))), count: 1, size: typeof g.count === 'number' ? g.count : 1 })}>+</Button>}>
        {partitions.length > 0 && (
          <div className="topo-insp-grid part">
            <span className="head">Key</span><span className="head">Count</span><span className="head">Size</span><span />
            {partitions.map((p, i) => (isObj(p) ? (
              <Fragment key={i}>
                <Draft value={text(p.key)} label={`Partition ${i + 1} key`} accept={(v) => NAME.test(v)} onCommit={(v) => set(['partitions', i, 'key'], v)} />
                {isObj(p.sizes) ? (
                  <Draft value={sizesText(p.sizes)} label={`Partition ${i + 1} sizes`} title="Devices per set: 1: 54, 2: 18" style={{ gridColumn: 'span 2' }}
                    accept={(v) => !!parseSizes(v)} onCommit={(v) => set(['partitions', i, 'sizes'], parseSizes(v)!)} />
                ) : (
                  <>
                    <Draft value={text(p.count)} label={`Partition ${i + 1} count`} accept={(v) => int(v) !== undefined} onCommit={(v) => set(['partitions', i, 'count'], int(v)!)} />
                    <Draft value={text(p.size)} label={`Partition ${i + 1} size`} accept={(v) => int(v) !== undefined} onCommit={(v) => set(['partitions', i, 'size'], int(v)!)} />
                  </>
                )}
                <RemoveButton label={`Remove partition ${text(p.key)}`} onClick={() => set(['partitions', i], undefined)} />
              </Fragment>
            ) : null))}
          </div>
        )}
      </Section>

      {deviceType && (
        <Section title="Port map" actions={
          <Button className="btn-icon" aria-label="Add port map entry" title="Add port map entry"
            onClick={() => set(['port_map', portMap.length], firstPorts
              ? { ports: `p{1-${firstPorts.count}}`, device_ports: `${firstPorts.id}/{1-${firstPorts.count}}` }
              : { ports: 'p{1-4}', device_ports: 'p/{1-4}' })}>+</Button>}>
          {portMap.length > 0 && (
            <div className="topo-insp-grid map">
              <span className="head">Ports</span><span className="head">Device ports</span><span />
              {portMap.map((e, i) => (isObj(e) ? (
                <Fragment key={i}>
                  <Draft value={text(e.ports)} label={`Port map ${i + 1} ports`} accept={(v) => !!v.trim()} onCommit={(v) => set(['port_map', i, 'ports'], v.trim())} />
                  <Draft value={text(e.device_ports)} label={`Port map ${i + 1} device ports`} title={device ? `${device.name}: ${device.ports.map((p) => `${p.id}/1-${p.count}`).join(', ')}` : undefined}
                    accept={(v) => !!v.trim()} onCommit={(v) => set(['port_map', i, 'device_ports'], v.trim())} />
                  <RemoveButton label={`Remove port map entry ${i + 1}`} onClick={() => set(['port_map', i], undefined)} />
                </Fragment>
              ) : null))}
            </div>
          )}
        </Section>
      )}

      <Section title="Port pools" actions={
        <Button className="btn-icon" aria-label="Add port pool" title="Add port pool"
          onClick={() => set(['ports', newKey('pool', Object.keys(pools))], 'p{1-4}')}>+</Button>}>
        {Object.keys(pools).length > 0 && (
          <div className="topo-insp-grid pool">
            <span className="head">Pool</span><span className="head">Ports</span><span className="head num">#</span><span />
            {Object.entries(pools).map(([pool, v]) => (
              <Fragment key={pool}>
                <Draft value={pool} label={`Pool ${pool} name`} accept={(n) => NAME.test(n) && !(n in pools)} onCommit={(n) => onSource(renamePool(source, name, pool, n))} />
                <Draft value={text(v)} label={`Pool ${pool} ports`} title="A pattern (etp{1-32}{a,b}), or a list of them per peer slot ([etp{1-4}, etp{5-8}])"
                  accept={(s) => poolValue(s) !== undefined} onCommit={(s) => set(['ports', pool], poolValue(s)!)} />
                <span className="num muted">{vg?.pools[pool] ?? ''}</span>
                <RemoveButton label={`Remove pool ${pool}`} onClick={() => set(['ports', pool], undefined)} />
              </Fragment>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function LinkPanel({ source, virtual, onSource, onSelect, doc, index, t }: Props & { doc: Obj; index: number; t: Obj }) {
  const set = (path: YamlPath, v: YamlValue | undefined) => onSource(setLinkField(source, index, path, v));
  const groups = isObj(doc.device_set_groups) ? doc.device_set_groups : {};
  const poolsOf = (group: string) => { const g = groups[group]; return isObj(g) && isObj(g.ports) ? Object.keys(g.ports) : []; };
  const pattern = isObj(t.pattern) ? t.pattern : {};
  const map = Array.isArray(t.map) ? t.map : [];
  const vl = virtual.links.find((l) => l.index === index);
  const name = text(t.name) || `link ${index + 1}`;
  const remove = () => {
    if (!confirm(`Delete link ${name}?`)) return;
    onSource(deleteLink(source, index));
    onSelect(undefined);
  };
  const end = (side: 'from' | 'to') => {
    const e = isObj(t[side]) ? t[side] : {};
    const group = text(e.group);
    const pools = poolsOf(group);
    const filters = isObj(e.filters) ? Object.entries(e.filters).map(([k, v]) => `${k} = ${text(v)}`).join(', ') : '';
    return (
      <Section title={side === 'from' ? 'From' : 'To'}>
        <div className="row2">
          <Field label="Group">
            <select aria-label={`${side} group`} value={group} onChange={(ev) => {
              const g = ev.target.value;
              let s = setLinkField(source, index, [side, 'group'], g);
              // A pool the new group lacks: its first pool.
              if (!poolsOf(g).includes(text(e.ports)) && poolsOf(g).length) s = setLinkField(s, index, [side, 'ports'], poolsOf(g)[0]);
              onSource(s);
            }}>
              {!(group in groups) && <option value={group}>{group || '—'}</option>}
              {Object.keys(groups).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Port pool">
            <select aria-label={`${side} port pool`} value={text(e.ports)} onChange={(ev) => set([side, 'ports'], ev.target.value)}>
              {!pools.includes(text(e.ports)) && <option value={text(e.ports)}>{text(e.ports) || '—'}</option>}
              {pools.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Key (instances pair by it)">
          <Draft value={text(e.key)} label={`${side} key`} placeholder="${partition}, e.g. ${pod}"
            onCommit={(v) => set([side, 'key'], v.trim() || undefined)} />
        </Field>
        {filters && <p className="muted topo-insp-note">{`Filters: ${filters} (edit in code)`}</p>}
      </Section>
    );
  };
  return (
    <div className="topo-insp">
      <Head title="Link" what={`link ${name}`} onDelete={remove} />
      <Field label="Name"><Draft value={text(t.name)} label="Link name" accept={(v) => !!v.trim()} onCommit={(v) => set(['name'], v.trim())} /></Field>
      {vl?.links !== undefined && <p className="muted topo-insp-note">{`${vl.links.toLocaleString('en-US')} links`}</p>}
      {end('from')}
      {end('to')}
      <Section title="Pattern">
        <div className="row2">
          <Field label="Type">
            <select aria-label="Pattern type" value={text(pattern.type) || 'mesh'} onChange={(e) => set(['pattern', 'type'], e.target.value)}>
              <option value="mesh">mesh</option>
              <option value="round-robin">round-robin</option>
            </select>
          </Field>
          <Field label="Per pair">
            <Draft value={text(pattern.per_pair) || '1'} label="Links per pair" accept={(v) => (int(v) ?? 0) > 0} onCommit={(v) => set(['pattern', 'per_pair'], int(v)!)} />
          </Field>
        </div>
        {map.length > 0 && (
          <p className="muted topo-insp-note">
            {`Map (edit in code): ${map.map((m) => (isObj(m) ? `${Array.isArray(m.from) ? m.from.map(text).join(', ') : text(m.from)} → ${text(m.to)}` : '')).join('; ')}`}
          </p>
        )}
      </Section>
    </div>
  );
}
