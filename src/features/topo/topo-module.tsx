import { useDeferredValue, useMemo, useState } from 'react';
import { useAppStore } from '../../state/store';
import { useLibrary } from '../../state/use-library';
import { slugify, uniqueId } from '../../domain/ids';
import { ModuleLayout } from '../../ui/module-layout';
import { Sidebar } from '../../ui/sidebar';
import { CanvasFrame, EmptyCanvas } from '../../ui/canvas-frame';
import { Splitter } from '../../ui/splitter';
import { TOPOLOGY_SCHEMA, parseVirtual, type Topology } from '../../domain/topo/virtual';
import { DEFAULT_OPTIONS, layoutDiagram, type DiagramOptions } from '../../domain/topo/diagram';
import type { TopoBomSettings } from '../../domain/topo/bom';
import { DiagramMenu } from './diagram-menu';
import { SAMPLE_TOPOLOGY } from '../../domain/topo/sample';
import { TopoEditor } from './topo-editor';
import { TopoDiagramView } from './topo-diagram';
import { TopoBomPane } from './topo-bom';

const CODE_W = 560;
const BOM_H = 300;
/** BOM settings of a topology that has none (stable, so the estimate is not recomputed every render). */
const NO_BOM: TopoBomSettings = {};

/**
 * Topo Builder: a topology file's source (left), the diagram of its virtual topology (right) and, under it, the
 * estimated BOM.
 */
export function TopoModule() {
  const topologies = useAppStore((s) => s.project.topologies);
  const selectedId = useAppStore((s) => s.selected.topo);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const update = useAppStore((s) => s.update);
  const remove = useAppStore((s) => s.remove);
  const lib = useLibrary();
  const [codeW, setCodeW] = useState(CODE_W);
  const [bomH, setBomH] = useState(BOM_H);
  const [options, setOptions] = useState<DiagramOptions>(DEFAULT_OPTIONS);
  const topo = topologies.find((t) => t.id === selectedId);
  // Parse off the typing path: the diagram follows the source a frame later on big files.
  const source = useDeferredValue(topo?.source ?? '');
  const virtual = useMemo(() => parseVirtual(source), [source]);
  const view = topo?.view;
  const diagram = useMemo(() => layoutDiagram(virtual, options, view), [virtual, options, view]);

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
        )} />}
      canvas={topo ? (
        <div className="topo-split" style={{ gridTemplateColumns: `minmax(0, ${codeW}px) 0 minmax(240px, 1fr)` }}>
          <TopoEditor value={topo.source} problems={virtual.problems}
            onChange={(v) => update('topologies', topo.id, (t) => ({ ...t, source: v }))} />
          <Splitter label="Code width" width={codeW} direction={1} onResize={(px) => setCodeW(Math.max(240, Math.min(1600, px)))} onReset={() => setCodeW(CODE_W)} />
          <div className="topo-right">
            <CanvasFrame title={`${topo.name} — virtual topology`} exportName={`${topo.id}-virtual`} fitKey={`${topo.id}:${diagram.width}`}
              viewControls={<DiagramMenu topo={virtual} options={options} onChange={setOptions}
                onResetView={view && (Object.keys(view.offsets ?? {}).length || view.collapsed?.length)
                  ? () => update('topologies', topo.id, (t) => ({ ...t, view: undefined })) : undefined} />}>
              {(ref) => virtual.groups.length
                ? <TopoDiagramView ref={ref} topo={virtual} diagram={diagram} view={view ?? {}}
                    onView={(vw) => update('topologies', topo.id, (t) => ({ ...t, view: vw }))} />
                : <div className="empty-canvas">No device set groups to draw.</div>}
            </CanvasFrame>
            <Splitter orientation="horizontal" label="BOM height" width={bomH} direction={-1}
              onResize={(px) => setBomH(Math.max(60, Math.min(1200, px)))} onReset={() => setBomH(BOM_H)} />
            <TopoBomPane lib={lib} topo={virtual} settings={topo.bom ?? NO_BOM} filename={topo.id} height={bomH}
              onChange={(b) => update('topologies', topo.id, (t) => ({ ...t, bom: b.devices || b.optics || b.items ? b : undefined }))} />
          </div>
        </div>
      ) : <EmptyCanvas text="Select or create a topology." />}
    />
  );
}
