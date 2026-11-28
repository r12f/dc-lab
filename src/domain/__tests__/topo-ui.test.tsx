import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { Library } from '../library/library';
import { emptyProject, type Project } from '../project/types';
import type { ItemVariant } from '../items/types';
import { TOPOLOGY_SCHEMA, parseVirtual } from '../topo/virtual';
import { topoHardware } from '../topo/hardware';
import { setDcId, setGroupField, setLinkField } from '../topo/edit';
import { cableBomToCsv, estimateTopoBom } from '../topo/bom';
import { connectionsToCsv, expandTopoConnections } from '../topo/connections';
import { topoDeviceIdMap } from '../topo/devices';
import { SAMPLE_TOPOLOGY } from '../topo/sample';
import { useAppStore } from '../../state/store';
import { TopoModule } from '../../features/topo/topo-module';
import { TopoInspector, insertIdVariable } from '../../features/topo/topo-inspector';
import { TopoBomPane } from '../../features/topo/topo-bom';
import { CONNECTIONS_PAGE_SIZE, filterConnectionsWithPn } from '../../features/topo/topo-connections';

describe('Topo Builder UI: DC/device ID hints, link cable picker, and 2-tab Port Connections pane', () => {
  const customAec: ItemVariant = {
    id: 'aec-generic-800g-pn',
    name: '800G Active Cable PN',
    target: 'cable',
    itemId: 'aec-800g',
    vendor: 'Generic Optics Co',
    model: 'CAB-AEC-800G-2M',
    properties: {},
    specs: { typicalW: 6 },
  };
  const customMpo: ItemVariant = {
    id: 'mpo12-patch-pn',
    name: 'MPO-12 Patch PN',
    target: 'cable',
    itemId: 'mpo12-smf',
    vendor: 'Generic Fiber Co',
    model: 'FBR-MPO12-SMF-5M',
    properties: {},
  };

  const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, {
    ...emptyProject(),
    variants: [customAec, customMpo],
  });

  it('renders DC ID input in TopoModule sidebar header, commits setDcId, and surfaces deviceIdProblems in the editor', () => {
    const initial = useAppStore.getInitialState();
    const prevProject = initial.project;
    const prevSelected = initial.selected;
    try {
      const badIdSource = `topology: pod-alpha
dc:
  id: dc-east
device_set_groups:
  g1:
    role: compute
    count: 2
    id_format: "fixed-id"
    ports:
      p: e{1-2}
  g2:
    role: leaf
    count: 1
    id_format: "{dc.id}-{bogus.var}"
    ports:
      p: e{1-2}
`;
      const nextProject: Project = {
        ...emptyProject(),
        topologies: [
          {
            schema: TOPOLOGY_SCHEMA,
            id: 'topo-test',
            name: 'Pod Alpha',
            source: badIdSource,
          },
        ],
      };
      const nextSelected = { ...prevSelected, topo: 'topo-test' };
      Object.assign(initial, { project: nextProject, selected: nextSelected });
      useAppStore.setState({ project: nextProject, selected: nextSelected });

      const html = renderToStaticMarkup(<TopoModule />);
      expect(html).toContain('aria-label="Topology name"');
      expect(html).toContain('aria-label="DC id"');
      expect(html).toContain('placeholder="pod-alpha"');
      expect(html).toContain('value="dc-east"');
      // Both deviceIdProblems surface immediately in TopoEditor's problem list.
      expect(html).toContain('group g1: duplicate device id &quot;fixed-id&quot;');
      expect(html).toContain('group g2: id_format &quot;{dc.id}-{bogus.var}&quot; uses unknown variable &quot;{bogus.var}&quot;');

      // Rewriting dc.id updates YAML in place and removes `dc` when cleared.
      const updated = setDcId(badIdSource, 'dc-west-2');
      expect(parseVirtual(updated).dc).toEqual({ id: 'dc-west-2' });
      const cleared = setDcId(updated, '   ');
      expect(parseVirtual(cleared).dc).toBeUndefined();
      expect(cleared).not.toContain('\ndc:');
    } finally {
      Object.assign(initial, { project: prevProject, selected: prevSelected });
      useAppStore.setState({ project: prevProject, selected: prevSelected });
    }
  });

  it('renders Device ID format, multi-partition variable hint chips, :N padding hint, and live range preview in GroupPanel', () => {
    let src = setDcId(SAMPLE_TOPOLOGY, 'us-west-1');
    let v = parseVirtual(src);
    let hw = topoHardware(lib, v);

    const initialHtml = renderToStaticMarkup(
      <TopoInspector
        lib={lib}
        source={src}
        virtual={v}
        hardware={hw}
        selection={{ kind: 'group', name: 't0' }}
        onSelect={() => {}}
        onSource={() => {}}
      />,
    );

    expect(initialHtml).toContain('aria-label="Device ID format"');
    expect(initialHtml).toContain('placeholder="{group.id}-{device.index}"');
    // Default preview for t0 (32 devices): t0-1 … t0-32
    expect(initialHtml).toContain('Preview: t0-1 … t0-32');

    // All built-in tokens, both partition keys (`su`, `plane`) and their `.index` tokens, plus `:N` padding hint.
    for (const token of [
      '{dc.id}',
      '{topology.id}',
      '{group.id}',
      '{group.role}',
      '{device.index}',
      '{set.index}',
      '{set.device.index}',
      '{su}',
      '{su.index}',
      '{plane}',
      '{plane.index}',
      '{set.index:3}',
    ]) {
      expect(initialHtml).toContain(`>${token}</button>`);
    }

    // Building an id_format with insertIdVariable (chip clicks) and writing via setGroupField updates YAML & preview.
    let fmt = '';
    fmt = insertIdVariable(fmt, '{dc.id}');
    fmt = insertIdVariable(fmt, '-');
    fmt = insertIdVariable(fmt, '{group.role}');
    fmt = insertIdVariable(fmt, '-su');
    fmt = insertIdVariable(fmt, '{su}');
    fmt = insertIdVariable(fmt, '-p');
    fmt = insertIdVariable(fmt, '{plane}');
    fmt = insertIdVariable(fmt, '-');
    fmt = insertIdVariable(fmt, '{set.device.index:2}');
    expect(fmt).toBe('{dc.id}-{group.role}-su{su}-p{plane}-{set.device.index:2}');

    src = setGroupField(src, 't0', ['id_format'], fmt);
    v = parseVirtual(src);
    hw = topoHardware(lib, v);
    expect(v.problems).toEqual([]);
    expect(v.groups.find((g) => g.name === 't0')?.idFormat).toBe(fmt);

    const updatedHtml = renderToStaticMarkup(
      <TopoInspector
        lib={lib}
        source={src}
        virtual={v}
        hardware={hw}
        selection={{ kind: 'group', name: 't0' }}
        onSelect={() => {}}
        onSource={() => {}}
      />,
    );
    expect(updatedHtml).toContain(`value="${fmt}"`);
    expect(updatedHtml).toContain('Preview: us-west-1-tor-su1-p1-01 … us-west-1-tor-su4-p8-01');

    // Clearing id_format removes `id_format:` from the group in YAML.
    const clearedSrc = setGroupField(src, 't0', ['id_format'], undefined);
    expect(parseVirtual(clearedSrc).groups.find((g) => g.name === 't0')?.idFormat).toBeUndefined();
  });

  it('renders LinkPanel Cable picker with compatible cables, incompatible/unknown fallbacks, and rewrites YAML in place', () => {
    const baseSrc = `topology: link-cable-ui
device_set_groups:
  leaf:
    role: leaf
    count: 2
    device_type: switch-64x800g-osfp
    ports:
      up: { ports: "osfp{1-2}{a,b}", optic: osfp-800g-2xdr4-ihs }
      raw: osfp{3-4}
  spine:
    role: spine
    count: 2
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "osfp{1-2}{a,b}", optic: osfp-800g-2xdr4-ihs }
      raw: osfp{3-4}
topo:
  - { name: opt-link, from: { group: leaf, ports: up }, to: { group: spine, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: dac-link, from: { group: leaf, ports: raw }, to: { group: spine, ports: raw }, pattern: { type: mesh, per_pair: 1 } }
`;
    const v0 = parseVirtual(baseSrc);
    const hw0 = topoHardware(lib, v0);
    const dacHtml = renderToStaticMarkup(
      <TopoInspector
        lib={lib}
        source={baseSrc}
        virtual={v0}
        hardware={hw0}
        selection={{ kind: 'link', index: 1 }}
        onSelect={() => {}}
        onSource={() => {}}
      />,
    );
    expect(dacHtml).toContain('aria-label="Link cable"');
    expect(dacHtml).toMatch(/<option value=""[^>]*>no cable<\/option>/);
    expect(dacHtml).toContain('<option value="aec-800g">800G OSFP AEC</option>');
    expect(dacHtml).toContain('<option value="dac-800g">800G OSFP DAC</option>');
    expect(dacHtml).not.toContain('value="lc-smf"');

    // Selecting a cable rewrites only that link spec in YAML.
    const withCableSrc = setLinkField(baseSrc, 0, ['cable'], 'mpo12-smf');
    expect(parseVirtual(withCableSrc).links[0].cable).toBe('mpo12-smf');

    // Setting an incompatible known cable shows `(incompatible)`; unknown cable ID shows `(unknown)`.
    const incompatSrc = setLinkField(baseSrc, 0, ['cable'], 'lc-smf');
    const vIncompat = parseVirtual(incompatSrc);
    const incompatHtml = renderToStaticMarkup(
      <TopoInspector
        lib={lib}
        source={incompatSrc}
        virtual={vIncompat}
        hardware={topoHardware(lib, vIncompat)}
        selection={{ kind: 'link', index: 0 }}
        onSelect={() => {}}
        onSource={() => {}}
      />,
    );
    expect(incompatHtml).toContain(`${lib.cableMedia.get('lc-smf')!.name} (incompatible)`);

    const unknownSrc = setLinkField(baseSrc, 0, ['cable'], 'missing-cable-id');
    const vUnknown = parseVirtual(unknownSrc);
    const unknownHtml = renderToStaticMarkup(
      <TopoInspector
        lib={lib}
        source={unknownSrc}
        virtual={vUnknown}
        hardware={topoHardware(lib, vUnknown)}
        selection={{ kind: 'link', index: 0 }}
        onSelect={() => {}}
        onSource={() => {}}
      />,
    );
    expect(unknownHtml).toContain('missing-cable-id (unknown)');
  });

  it('renders strictly 2 sub-tabs and populates Cable BOM summary, Cable PN, filtering, >200-row pagination, and CSV exports', () => {
    // 672 total links (> 3 pages of 200 rows) with DC id, custom id_format, hardware types, optics, and link cables.
    const largeSrc = `topology: cluster-su
dc:
  id: dc9
device_set_groups:
  srv:
    role: compute
    count: 64
    id_format: "{dc.id}-gpu-{device.index:3}"
    partitions:
      - { key: su, count: 4 }
    device_type: gpu-tray-1ru-lc-4x400g
    ports:
      be: { ports: "be{1-4}", optic: osfp-400g-dr4 }
      fe: { ports: "fe{1-4}", optic: qsfp112-400g-dr4-2km }
  be_sw:
    role: rail-leaf
    count: 8
    id_format: "{dc.id}-be-sw-{device.index:2}"
    partitions:
      - { key: su, count: 4 }
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "osfp{1-32}{a,b}", optic: osfp-800g-2xdr4-ihs }
  fe_sw:
    role: fe-leaf
    count: 8
    id_format: "{dc.id}-fe-sw-{device.index:2}"
    partitions:
      - { key: su, count: 4 }
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "osfp{1-32}{a,b}", optic: osfp-800g-2xdr4-ihs }
  core_leaf:
    role: core-leaf
    count: 8
    id_format: "{dc.id}-core-leaf-{device.index:2}"
    device_type: switch-64x800g-osfp
    ports:
      up: osfp{1-8}
  spine:
    role: spine
    count: 2
    id_format: "{dc.id}-spine-{device.index:2}"
    device_type: switch-64x800g-osfp
    ports:
      down: osfp{1-32}
topo:
  - { name: srv-be, from: { group: srv, key: "\${su}", ports: be }, to: { group: be_sw, key: "\${su}", ports: down }, pattern: { type: mesh, per_pair: 2 }, cable: mpo12-smf }
  - { name: srv-fe, from: { group: srv, key: "\${su}", ports: fe }, to: { group: fe_sw, key: "\${su}", ports: down }, pattern: { type: mesh, per_pair: 2 }, cable: mpo12-smf }
  - { name: be-spine, from: { group: core_leaf, ports: up }, to: { group: spine, ports: down }, pattern: { type: mesh, per_pair: 4 }, cable: aec-800g }
`;
    const v = parseVirtual(largeSrc);
    expect(v.problems).toEqual([]);
    const hw = topoHardware(lib, v);
    const settings = {
      items: {
        'aec-800g': 'aec-generic-800g-pn',
        'mpo12-smf': 'mpo12-patch-pn',
      },
    };

    // Tab 1: Estimated BOM (default) — verify strictly 2 sub-tabs (Estimated BOM + Port Connections (576), NO 3rd tab).
    const bomTabHtml = renderToStaticMarkup(
      <TopoBomPane
        lib={lib}
        topo={v}
        hardware={hw}
        settings={settings}
        filename="cluster-su"
        height={320}
        onChange={() => {}}
      />,
    );
    const subtabsMatch = /<div class="subtabs">(.*?)<\/div>/.exec(bomTabHtml);
    expect(subtabsMatch).not.toBeNull();
    const tabButtons = [...subtabsMatch![1].matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1]);
    expect(tabButtons).toEqual(['Estimated BOM', 'Port Connections (576)']);
    expect(bomTabHtml).toContain('Hardware per group');

    // Tab 2: Port Connections — Page 0 (Showing 1–200 of 576).
    const connPage0Html = renderToStaticMarkup(
      <TopoBomPane
        lib={lib}
        topo={v}
        hardware={hw}
        settings={settings}
        filename="cluster-su"
        height={320}
        initialTab="connections"
        onChange={() => {}}
      />,
    );
    expect(connPage0Html).toContain('Connection summary (Cable BOM)');
    expect(connPage0Html).toContain('End-to-end port connections');
    expect(connPage0Html).toContain('Export Cable BOM CSV');
    expect(connPage0Html).toContain('Export Connections CSV');
    expect(connPage0Html).toContain('aria-label="Filter port connections"');

    // Cable BOM summary shows picked PNs, derivation notes, and active AEC power (2 ends * 6W = 12W/pcs, 64 * 12W = 768W).
    expect(connPage0Html).toContain('aria-label="Cable PN for srv-be"');
    expect(connPage0Html).toContain('Generic Fiber Co FBR-MPO12-SMF-5M');
    expect(connPage0Html).toContain('Generic Optics Co CAB-AEC-800G-2M');
    expect(connPage0Html).toContain('srv-be 256');
    expect(connPage0Html).toContain('be-spine 64');

    // End-to-end port connections page 0 renders exactly CONNECTIONS_PAGE_SIZE (200) rows with generated {dc.id} IDs & Cable PN.
    expect(connPage0Html).toContain('Showing 1–200 of 576');
    const connBody0 = /<table class="table topo-conn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(connPage0Html)![1];
    expect(connBody0.match(/<tr>/g)).toHaveLength(CONNECTIONS_PAGE_SIZE);
    expect(connBody0).toContain('dc9-gpu-001');
    expect(connBody0).toContain('dc9-be-sw-01');
    expect(connBody0).toContain('osfp/1 (lane a)');
    expect(connBody0).toContain('Generic Fiber Co FBR-MPO12-SMF-5M');

    // Page 2 (last page, index 2 -> rows 401–576, 176 rows including `be-spine` with `CAB-AEC-800G-2M`).
    const connPage2Html = renderToStaticMarkup(
      <TopoBomPane
        lib={lib}
        topo={v}
        hardware={hw}
        settings={settings}
        filename="cluster-su"
        height={320}
        initialTab="connections"
        initialPage={2}
        onChange={() => {}}
      />,
    );
    expect(connPage2Html).toContain('Showing 401–576 of 576');
    const connBody2 = /<table class="table topo-conn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(connPage2Html)![1];
    expect(connBody2.match(/<tr>/g)).toHaveLength(176);
    expect(connBody2).toContain('dc9-spine-01');
    expect(connBody2).toContain('Generic Optics Co CAB-AEC-800G-2M');

    // Filtering by Cable PN (`CAB-AEC-800G-2M`) narrows to the 64 `be-spine` rows and resets to Showing 1–64 of 64.
    const filteredHtml = renderToStaticMarkup(
      <TopoBomPane
        lib={lib}
        topo={v}
        hardware={hw}
        settings={settings}
        filename="cluster-su"
        height={320}
        initialTab="connections"
        initialFilter="CAB-AEC-800G-2M"
        onChange={() => {}}
      />,
    );
    expect(filteredHtml).toContain('Showing 1–64 of 64');

    // Verify underlying CSV payloads for both Export Cable BOM CSV and Export Connections CSV (filtered).
    const bom = estimateTopoBom(lib, v, settings);
    const cableCsv = cableBomToCsv(lib, bom.cableBom);
    expect(cableCsv).toContain('srv-be,srv,compute,');
    expect(cableCsv).toContain('Generic Optics Co CAB-AEC-800G-2M,64,be-spine 64,12,768');

    const allConns = expandTopoConnections(lib, v, hw, topoDeviceIdMap(v));
    const pnMap = new Map(bom.cableBom.map((r, i) => [v.links[i].index, r.vendorModel]));
    const filteredConns = filterConnectionsWithPn(allConns, 'dc9-spine-02', pnMap);
    expect(filteredConns).toHaveLength(32);
    const connCsv = connectionsToCsv(filteredConns);
    expect(connCsv.split('\n')).toHaveLength(33); // header + 32 filtered rows
    expect(connCsv).toContain('be-spine,dc9-core-leaf-01,core_leaf,core-leaf,up,osfp5,osfp/5,1x800G,,dc9-spine-02');
  });
});
