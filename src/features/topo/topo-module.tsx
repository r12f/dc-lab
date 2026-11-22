import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../state/store';
import { useLibrary } from '../../state/use-library';
import { usePreferences } from '../../state/preferences';
import { slugify, uniqueId } from '../../domain/ids';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { Splitter } from '../../ui/splitter';
import { TOPOLOGY_SCHEMA, parseVirtual, type Topology } from '../../domain/topo/virtual';
import { DEFAULT_OPTIONS, layoutDiagram, type DiagramOptions, type DiagramView } from '../../domain/topo/diagram';
import type { TopoBomSettings } from '../../domain/topo/bom';
import { hardwareProblems, topoHardware } from '../../domain/topo/hardware';
import { addGroup, addLink, newGroupName, newLinkName, topoDoc } from '../../domain/topo/edit';
import type { YamlValue } from '../../domain/topo/yaml';
import { DiagramMenu } from './diagram-menu';
import { SAMPLE_TOPOLOGY } from '../../domain/topo/sample';
import { TopoEditor } from './topo-editor';
import { TopoDiagramView } from './topo-diagram';
import { TopoBomPane } from './topo-bom';
import { TopoInspector, type TopoSelection } from './topo-inspector';
import { TopoNewMenu } from './topo-new-menu';

const CODE_W = 560;
const BOM_H = 300;
/** Width (px) of the rail a hidden code pane leaves. */
const RAIL = 28;
/** BOM settings of a topology that has none (stable, so the estimate is not recomputed every render). */
const NO_BOM: TopoBomSettings = {};

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** A view with a renamed group's moved / collapsed state under its new name. */
function renameInView(view: DiagramView | undefined, from: string, to: string): DiagramView | undefined {
  if (!view) return view;
  const rename = (k: string) => (k === from ? to : k);
  return {
    ...view,
    ...(view.offsets ? { offsets: Object.fromEntries(Object.entries(view.offsets).map(([k, v]) => [rename(k), v])) } : {}),
    ...(view.collapsed ? { collapsed: view.collapsed.map(rename) } : {}),
  };
}

/**
 * Topo Builder: a topology file's source (left, can be hidden), the diagram of its virtual topology (right) and,
 * under it, the estimated BOM. A block or link clicked in the diagram is edited in the sidebar panel; "+ New" adds
 * them. Every edit rewrites the file's lines in place.
 */
export function TopoModule() {
  const topologies = useAppStore((s) => s.project.topologies);
  const selectedId = useAppStore((s) => s.selected.topo);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const update = useAppStore((s) => s.update);
  const remove = useAppStore((s) => s.remove);
  const lib = useLibrary();
  const codeHidden = usePreferences((s) => s.collapsed.topoCode);
  const togglePane = usePreferences((s) => s.togglePane);
  const [codeW, setCodeW] = useState(CODE_W);
  const [bomH, setBomH] = useState(BOM_H);
  const [options, setOptions] = useState<DiagramOptions>(DEFAULT_OPTIONS);
  const [selection, setSelection] = useState<TopoSelection>();
  useEffect(() => setSelection(undefined), [selectedId]);
  const topo = topologies.find((t) => t.id === selectedId);
  // Parse off the typing path: the diagram follows the source a frame later on big files.
  const source = useDeferredValue(topo?.source ?? '');
  const virtual = useMemo(() => parseVirtual(source), [source]);
  // Device types and port maps are checked against the Devices module.
  const hardware = useMemo(() => topoHardware(lib, virtual), [lib, virtual]);
  const problems = useMemo(() => [...virtual.problems, ...hardwareProblems(lib, virtual, hardware)], [virtual, lib, hardware]);
  // The file as a map, for adding blocks and links (undefined while it does not parse).
  const doc = useMemo(() => { try { return topoDoc(topo?.source ?? ''); } catch { return undefined; } }, [topo?.source]);
  const groups = doc && isObj(doc.device_set_groups) ? doc.device_set_groups : {};
  const view = topo?.view;
  // Each box names its device type as the Devices module does (an id it lacks: as written, flagged in the problems).
  const devices = useMemo(() => Object.fromEntries(virtual.groups.filter((g) => g.deviceType)
    .map((g) => [g.name, lib.devices.get(g.deviceType)?.name ?? g.deviceType!])), [virtual, lib]);
  const diagram = useMemo(() => layoutDiagram(virtual, options, view, devices), [virtual, options, view, devices]);

  /** A new file text; a renamed group carries its moved / collapsed state, split choice and selection along. */
  const setSource = (next: string, renamed?: { from: string; to: string }) => {
    if (!topo) return;
    update('topologies', topo.id, (t) => ({ ...t, source: next, ...(renamed ? { view: renameInView(t.view, renamed.from, renamed.to) } : {}) }));
    if (!renamed) return;
    setSelection({ kind: 'group', name: renamed.to });
    setOptions((o) => (renamed.from in o.partition
      ? { ...o, partition: Object.fromEntries(Object.entries(o.partition).map(([k, v]) => [k === renamed.from ? renamed.to : k, v])) }
      : o));
  };
  /** "+ New": a group (one device, one pool), or a link from the selected group (else the first) to another one. */
  const add = (kind: 'group' | 'link') => {
    if (!topo || !doc) return;
    if (kind === 'group') {
      const name = newGroupName(topo.source);
      setSource(addGroup(topo.source, name, { role: 'device', count: 1, ports: { p: 'p{1-4}' } }));
      setSelection({ kind: 'group', name });
      return;
    }
    const names = Object.keys(groups);
    const from = selection?.kind === 'group' && names.includes(selection.name) ? selection.name : names[0];
    const to = names.find((n) => n !== from) ?? from;
    const pool = (g: string) => { const x = groups[g]; return (isObj(x) && isObj(x.ports) ? Object.keys(x.ports)[0] : undefined) ?? 'p'; };
    const { source: next, index } = addLink(topo.source, {
      name: newLinkName(topo.source), from: { group: from, ports: pool(from) }, to: { group: to, ports: pool(to) }, pattern: { type: 'mesh', per_pair: 1 },
    });
    setSource(next);
    setSelection({ kind: 'link', index });
  };

  const create = () => {
    const t: Topology = { schema: TOPOLOGY_SCHEMA, id: uniqueId(slugify('topology'), topologies.map((x) => x.id)), name: 'New topology', source: SAMPLE_TOPOLOGY };
    upsert('topologies', t);
    select('topo', t.id);
  };
  const duplicate = (id: string) => {
    const src = topologies.find((t) => t.id === id);
    if (!src) return;
    const copy = { ...src, id: uniqueId(`${src.id}-copy`, topologies.map((x) => x.id)), name: `${src.name} (copy)` };
    upsert('topologies', copy);
    select('topo', copy.id);
  };
  const problemsText = problems.length ? ` · ${problems.length} problem${problems.length > 1 ? 's' : ''}` : '';
  return (
    <ModuleLayout
      sidebar={<Sidebar title="Topologies" filterable selectedId={selectedId}
        items={topologies.map((t) => ({ id: t.id, name: t.name, path: [], keywords: t.source.slice(0, 400) }))}
        onSelect={(id) => select('topo', id)} onNew={create} onDuplicate={duplicate}
        onDelete={(id) => { if (confirm('Delete this topology?')) { remove('topologies', id); select('topo', undefined); } }}
        emptyText="Create a topology."
        header={topo && (
          <div className="pad topo-name">
            <input aria-label="Topology name" value={topo.name} onChange={(e) => update('topologies', topo.id, (t) => ({ ...t, name: e.target.value }))} />
          </div>
        )}
        lower={topo && (
          <TopoInspector lib={lib} source={topo.source} virtual={virtual} hardware={hardware}
            selection={selection} onSelect={setSelection} onSource={setSource} />
        )} />}
      canvas={topo ? (
        <div className="topo-split" style={{ gridTemplateColumns: `${codeHidden ? `${RAIL}px` : `minmax(0, ${codeW}px)`} 0 minmax(240px, 1fr)` }}>
          {/* Hidden, the code pane stays mounted (scroll and caret kept) behind a rail. */}
          {codeHidden && (
            <button type="button" className={`pane-rail pane-rail-left ${problems.length ? 'bad' : ''}`} title="Show the code" aria-label="Show the code"
              onClick={() => togglePane('topoCode')}><b>»</b><span>{`Code${problemsText}`}</span></button>
          )}
          <div className="pane-wrap" hidden={codeHidden}>
            <TopoEditor value={topo.source} problems={problems} onChange={(v) => setSource(v)} />
            <button type="button" className="pane-toggle pane-toggle-left" title="Hide the code" aria-label="Hide the code"
              onClick={() => togglePane('topoCode')}>«</button>
          </div>
          {codeHidden
            ? <span />
            : <Splitter label="Code width" width={codeW} direction={1} onResize={(px) => setCodeW(Math.max(240, Math.min(1600, px)))} onReset={() => setCodeW(CODE_W)} />}
          <div className="topo-right">
            <CanvasFrame title={`${topo.name} — virtual topology`} exportName={`${topo.id}-virtual`} fitKey={`${topo.id}:${diagram.width}`}
              toolbar={<>
                <TopoNewMenu onAdd={add} canLink={Object.keys(groups).length > 0} disabled={doc ? undefined : 'Fix the YAML problems first'} />
                <span className="toolbar-sep" />
              </>}
              viewControls={<DiagramMenu topo={virtual} options={options} onChange={setOptions}
                onResetView={view && (Object.keys(view.offsets ?? {}).length || view.collapsed?.length)
                  ? () => update('topologies', topo.id, (t) => ({ ...t, view: undefined })) : undefined} />}>
              {(ref) => virtual.groups.length
                ? <TopoDiagramView ref={ref} topo={virtual} diagram={diagram} view={view ?? {}}
                    onView={(vw) => update('topologies', topo.id, (t) => ({ ...t, view: vw }))}
                    selection={selection} onSelect={setSelection} />
                : <div className="empty-canvas">No device set groups to draw.</div>}
            </CanvasFrame>
            <Splitter orientation="horizontal" label="BOM height" width={bomH} direction={-1}
              onResize={(px) => setBomH(Math.max(60, Math.min(1200, px)))} onReset={() => setBomH(BOM_H)} />
            <TopoBomPane lib={lib} topo={virtual} settings={topo.bom ?? NO_BOM} filename={topo.id} height={bomH}
              onChange={(b) => update('topologies', topo.id, (t) => ({ ...t, bom: b.items ? b : undefined }))} />
          </div>
        </div>
      ) : <EmptyCanvas text="Select or create a topology." />}
    />
  );
}
