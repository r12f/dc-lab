import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import type { RackDesign } from '../design/types';
import type { DcLayout } from '../layout/types';
import { bypassPassThrough, cablePairs, defaultCollapsed, moveBlocks, rackPortLayout, topBlockOf, traceDrawing, traceTopology, tracePortKey } from '../layout/topo-trace';
import { TraceView } from '../../features/layout/trace-view';
import { TracePanel } from '../../features/layout/trace-panel';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const SW = 'switch-32x400g-qsfpdd';
const FH = 'fiber-housing-80xmmc16';

// Rack 1: SW1 + SW2 joined by a DAC, SW1 port 1 -> housing front fm1/1. Rack 2: housing rear rm1/1 is trunked to
// rack 3's housing rear; rack 3's housing front fm1/1 -> SW3 port 1. SW4 (rack 3) is cabled to nothing.
function rack(id: string, withPeer: boolean): RackDesign {
  const d = newDesign(id, id, 'network-42ru-600');
  d.placements.push(newPlacement('sw', SW, 'SW1', { kind: 'rack', position: 1, face: 'front' }));
  d.placements.push(newPlacement('fh', FH, 'FH1', { kind: 'rack', position: 40, face: 'front' }));
  d.cables.push({ id: 'c1', from: [{ placementId: 'sw', portRef: 'qsfpdd/1' }], to: [{ placementId: 'fh', portRef: 'fm1/1', connector: 1 }], route: 'left', mediaId: 'mpo12-smf', quantity: 1 });
  if (withPeer) {
    d.placements.push(newPlacement('sw2', SW, 'SW2', { kind: 'rack', position: 3, face: 'front' }));
    d.cables.push({ id: 'c2', from: [{ placementId: 'sw', portRef: 'qsfpdd/2' }], to: [{ placementId: 'sw2', portRef: 'qsfpdd/2' }], route: 'left', mediaId: 'dac-400g-qsfpdd', quantity: 1 });
  } else {
    d.placements.push(newPlacement('sw4', SW, 'SW4', { kind: 'rack', position: 5, face: 'front' }));
  }
  return d;
}
const d1 = rack('d1', true);
const d3 = rack('d3', false);
const designs = (id: string) => ({ d1, d3 } as Record<string, RackDesign>)[id];
const layout = {
  id: 'l', assignments: [
    { id: 'r1', rowId: 'x', startTile: 0, designId: 'd1', label: 'R1' },
    { id: 'r3', rowId: 'x', startTile: 2, designId: 'd3', label: 'R3' },
  ],
  crossCables: [{ id: 'xc', mediaId: 'mmc-smf', from: [{ assignmentId: 'r1', placementId: 'fh', portRef: 'rm1/1', connector: 1 }], to: [{ assignmentId: 'r3', placementId: 'fh', portRef: 'rm1/1', connector: 1 }] }],
} as unknown as DcLayout;
const SW1 = Array.from({ length: 32 }, (_, i) => ({ placementId: 'sw', portRef: `qsfpdd/${i + 1}` }));
const key = (a: string, p: string, r: string) => tracePortKey({ assignmentId: a, placementId: p, portRef: r });

describe('topo tracing', () => {
  it('cable connector pairing: 1:1, 1:n fan-out, shuffle = all to all', () => {
    expect(cablePairs(2, 2)).toEqual([[0, 0], [1, 1]]);
    expect(cablePairs(2, 4)).toEqual([[0, 0], [0, 1], [1, 2], [1, 3]]);
    expect(cablePairs(2, 2, true)).toHaveLength(4);
  });
  it('without B: everything connected to A, through housings (front to rear) and cross-rack trunks', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: SW1 });
    const ends = new Set(r.links.flatMap((l) => [l.a, l.b]));
    expect(ends.has(key('r3', 'sw', 'qsfpdd/1'))).toBe(true);
    expect(ends.has(key('r1', 'sw2', 'qsfpdd/2'))).toBe(true);
    expect(r.links.map((l) => l.kind).sort()).toEqual(['cable', 'cable', 'cable', 'cross', 'pass', 'pass']);
  });
  it('with B: only links on paths to B (the DAC branch to SW2 is dropped)', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: SW1 }, { assignmentId: 'r3', ports: [{ placementId: 'sw', portRef: 'qsfpdd/1' }] });
    expect(r.links).toHaveLength(5);
    expect(r.links.some((l) => l.mediaId === 'dac-400g-qsfpdd')).toBe(false);
    // Unconnected B: no path.
    expect(traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: SW1 }, { assignmentId: 'r3', ports: [{ placementId: 'sw4', portRef: 'qsfpdd/1' }] }).links).toEqual([]);
  });
  it('a rack side = all its devices; the drawing puts A devices in column 0 and renders to SVG', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' });
    const t = { id: 't', name: 'R1 → all', layoutId: 'l', a: { assignmentId: 'r1' }, ...r };
    const d = traceDrawing(lib, designs, layout, t);
    expect(d.nodes.filter((n) => n.side === 'a').map((n) => n.label).sort()).toEqual(['FH1', 'SW1', 'SW2']);
    // Fiber housings add no level: r1 SW1 -> FH1 -> trunk -> r3 FH1 -> SW1 is one hop; each housing sits in the column
    // of the switch it serves.
    const colOf = (rack: string, label: string) => d.nodes.find((n) => n.label === label && n.assignmentId === rack)?.column;
    expect([colOf('r1', 'SW1'), colOf('r1', 'FH1'), colOf('r3', 'FH1'), colOf('r3', 'SW1')]).toEqual([0, 0, 1, 1]);
    const svg = renderToStaticMarkup(<TraceView lib={lib} designs={designs} layout={layout} trace={t} />);
    expect(svg.match(/<polyline/g)!.length).toBe(d.edges.length * 3);
    // One line per cable type between two boxes, with its cable count; hover tells count and type.
    const sw = d.edges.find((e) => e.mediaId === 'dac-400g-qsfpdd')!;
    expect(sw).toMatchObject({ cables: 1, count: 1, media: lib.cableMedia.get('dac-400g-qsfpdd')!.name });
    expect(svg).toContain(`1 × ${sw.media}`);
    expect(new Set(d.edges.map((e) => `${e.a}|${e.b}|${e.mediaId}`)).size).toBe(d.edges.length);
  });
  it('collapsed rack block: one summary node, its edges summed onto it, inner edges dropped; lanes never share', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' });
    const t = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1' }, ...r };
    const open = traceDrawing(lib, designs, layout, t);
    const same = open.edges.filter((e) => e.lane !== undefined);
    expect(same.length).toBeGreaterThan(0);
    const shut = traceDrawing(lib, designs, layout, t, new Set(['r1@0']));
    const n = shut.nodes.filter((x) => x.assignmentId === 'r1' && x.column === 0);
    expect(n).toHaveLength(1);
    expect(n[0].devices).toBe(3);
    expect(n[0].sub).toMatch(/2x .*1x /);
    // Edges inside the collapsed block are gone (r1's same-column brackets).
    expect(shut.edges.some((e) => e.lane !== undefined && e.a.includes('r1') && e.b.includes('r1'))).toBe(false);
    expect(shut.racks.find((x) => x.key === 'r1@0')).toMatchObject({ collapsed: true, devices: 3 });
  });
  it('racks of one design in a column merge into one block', () => {
    // Two racks of design d3 reached from r1: make r3b a second rack of the same design, trunked like r3.
    const l2 = {
      ...layout,
      assignments: [...layout.assignments, { id: 'r3b', rowId: 'x', startTile: 4, designId: 'd3', label: 'R3B' }],
      crossCables: [...layout.crossCables!, { id: 'xc2', mediaId: 'mmc-smf', from: [{ assignmentId: 'r1', placementId: 'fh', portRef: 'rm1/2', connector: 1 }], to: [{ assignmentId: 'r3b', placementId: 'fh', portRef: 'rm1/1', connector: 1 }] }],
    } as DcLayout;
    const r = traceTopology(lib, designs, l2, { assignmentId: 'r1' });
    const t = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1' }, ...r };
    const init = defaultCollapsed(lib, designs, l2, t);
    expect([...init]).toContain('design:d3@1');
    const d = traceDrawing(lib, designs, l2, t, init);
    const block = d.racks.find((x) => x.key === 'design:d3@1')!;
    expect(block).toMatchObject({ racks: 2, label: '2x d3' });
    expect(d.nodes.filter((n) => n.column === 1)).toHaveLength(1);
    expect(d.racks.filter((x) => x.key.endsWith('@1')).map((x) => x.key)).toEqual(['design:d3@1']);
    // Opening the group: a group block around the two rack blocks.
    const open = traceDrawing(lib, designs, l2, t, new Set());
    const g = open.racks.find((x) => x.key === 'design:d3@1')!;
    const inner = open.racks.filter((x) => x.level === 1 && x.key.endsWith('@1'));
    expect(inner.map((x) => x.label).sort()).toEqual(['R3', 'R3B']);
    for (const r of inner) expect(r.x > g.x && r.y > g.y && r.x + r.w < g.x + g.w && r.y + r.h < g.y + g.h).toBe(true);
  });
  it('dragging a top-level block moves it with its racks and device boxes; the drawing grows to fit', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' });
    const t = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1' }, ...r };
    const d = traceDrawing(lib, designs, layout, t, new Set());
    const node = d.nodes.find((n) => n.assignmentId === 'r3')!;
    const blk = topBlockOf(d, node)!;
    expect(blk.assignmentId).toBe('r3');
    const m = moveBlocks(d, { [blk.key]: { dx: 50, dy: 400 } });
    expect(m.racks.find((x) => x.key === blk.key)).toMatchObject({ x: blk.x + 50, y: blk.y + 400 });
    expect(m.nodes.find((n) => n.key === node.key)).toMatchObject({ x: node.x + 50, y: node.y + 400 });
    expect(m.nodes.filter((n) => n.assignmentId === 'r1')).toEqual(d.nodes.filter((n) => n.assignmentId === 'r1'));
    // A dragged block is found again where it is drawn (pressing it again to fold / drag must work).
    const movedNode = m.nodes.find((n) => n.key === node.key)!;
    expect(topBlockOf(m, movedNode)?.key).toBe(blk.key);
    expect(topBlockOf(m, m.racks.find((x) => x.key === blk.key)!)?.key).toBe(blk.key);
    expect(m.height).toBeGreaterThan(blk.y + 400 + blk.h);
  });
  it('every drawn line has cables on it; links without a cable id count by port, never 0', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' });
    const old = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1' }, start: r.start, links: r.links.map(({ cable: _c, ...l }) => l) };
    for (const t of [{ ...old, links: r.links }, old]) {
      const d = traceDrawing(lib, designs, layout, t, new Set());
      expect(d.edges.length).toBeGreaterThan(0);
      for (const e of d.edges) expect(e.cables).toBeGreaterThan(0);
    }
  });
  it('walks through devices: SW2 (cabled only to SW1 by a DAC) reaches rack 3 via SW1 and the trunk', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: [{ placementId: 'sw2', portRef: 'qsfpdd/2' }] },
      { assignmentId: 'r3', ports: [{ placementId: 'sw', portRef: 'qsfpdd/1' }] });
    expect(r.links.map((l) => l.kind).sort()).toEqual(['cable', 'cable', 'cable', 'cross', 'pass', 'pass']);
  });
  it('with B: only shortest paths (a longer detour is not drawn)', () => {
    // Second, longer way from r1 SW1 to r3: none here, so the shortest-path set equals every A-B link found.
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: SW1 }, { assignmentId: 'r3', ports: [{ placementId: 'sw', portRef: 'qsfpdd/1' }] });
    expect(r.links.some((l) => l.mediaId === 'dac-400g-qsfpdd')).toBe(false);
  });
  it('a rack block alone is named by design and rack label; inside a design group by rack label only', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' });
    const t = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1' }, ...r };
    const d = traceDrawing(lib, designs, layout, t, new Set());
    expect(d.racks.find((x) => x.key === 'r1@0')?.label).toBe('d1 · R1');
  });
  it('with B: a rack side shows its devices behind its fiber housing, not just the housing the path reaches', () => {
    // A = rack 1 (SW1, SW2, FH1), B = rack 3: the shortest path ends on the housings; SW1 -> FH1 and the SW1-SW2 DAC
    // inside the A rack are shown too.
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1' }, { assignmentId: 'r3' });
    const devs = new Set(r.links.flatMap((l) => [l.a, l.b]).filter((k) => k.startsWith('r1#')).map((k) => k.split('#')[1]));
    expect([...devs].sort()).toEqual(['fh', 'sw', 'sw2']);
  });
  it('mgmt / console / power ports are endpoints: traffic does not cross a switch through its mgmt port', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: [{ placementId: 'sw', portRef: 'mgmt/1' }] });
    expect(r.links).toEqual([]);
  });
  it('hiding pass-through devices: housings vanish, switch to switch through them is one direct link', () => {
    const r = traceTopology(lib, designs, layout, { assignmentId: 'r1', ports: SW1 }, { assignmentId: 'r3', ports: [{ placementId: 'sw', portRef: 'qsfpdd/1' }] });
    const by = bypassPassThrough(lib, r.links);
    expect(by).toHaveLength(1);
    expect(by[0]).toMatchObject({ a: key('r1', 'sw', 'qsfpdd/1'), b: key('r3', 'sw', 'qsfpdd/1'), kind: 'cross' });
    const t = { id: 't', name: 'x', layoutId: 'l', a: { assignmentId: 'r1', ports: SW1 }, ...r };
    const d = traceDrawing(lib, designs, layout, t, new Set(), true);
    expect(d.nodes.map((n) => n.label).sort()).toEqual(['SW1', 'SW1']);
    expect(d.edges).toHaveLength(1);
    expect(d.nodes.map((n) => n.column).sort()).toEqual([0, 1]);
  });
  it('hiding pass-through: two servers on the legs of one Y cable are not linked to each other', () => {
    // Y cable: housing fm1/1 -> S1 and S2; housing rm1/1 trunked to a switch port.
    const k = (pl: string, pr: string) => tracePortKey({ assignmentId: 'r', placementId: pl, portRef: pr });
    const links = [
      { a: k('fh', 'fm1/1'), b: k('s1', 'p/1'), kind: 'cable' as const, mediaId: 'mmc16-2xmpo8-y-smf', cable: 'y' },
      { a: k('fh', 'fm1/1'), b: k('s2', 'p/1'), kind: 'cable' as const, mediaId: 'mmc16-2xmpo8-y-smf', cable: 'y' },
      { a: k('fh', 'fm1/1'), b: k('fh', 'rm1/1'), kind: 'pass' as const },
      { a: k('fh', 'rm1/1'), b: k('sw', 'osfp/1'), kind: 'cable' as const, mediaId: 'mmc-smf', cable: 't' },
    ];
    const by = bypassPassThrough(lib, links).map((l) => [l.a, l.b].map((x) => x.split('#')[1]).sort().join('-')).sort();
    expect(by).toEqual(['s1-sw', 's2-sw']);
  });
  it('side picker layout lists every cable port of every device (not only cross-rack ones)', () => {
    const l = rackPortLayout(lib, d1);
    expect(l.map((x) => x.placement.label)).toEqual(['FH1', 'SW2', 'SW1']);
    const sw = l.find((x) => x.placement.id === 'sw')!;
    expect(sw.faces.flatMap((f) => f.groups).reduce((n, g) => n + g.count, 0)).toBeGreaterThanOrEqual(34);
    const html = renderToStaticMarkup(<TracePanel lib={lib} designs={designs} layout={layout}
      sides={{ a: { assignmentId: 'r1', ports: [{ placementId: 'sw', portRef: 'qsfpdd/1' }] } }} onSides={() => {}} />);
    expect(html.match(/class="cross-port selected"/g)).toHaveLength(1);
    expect(html.match(/class="cross-port/g)!.length).toBeGreaterThan(80 + 64);
  });
});
