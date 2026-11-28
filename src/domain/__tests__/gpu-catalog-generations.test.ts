import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { validateProfile } from '../device/breakout';
import { resolvePort } from '../device/port-settings';
import { cageOf, dataPorts, topoHardware } from '../topo/hardware';
import { parseVirtual } from '../topo/virtual';
import { layoutFace, SMALL_PORT, type Box } from '../../features/devices/drawing/faceplate-layout';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { applicableCables, placementConnectors, planAssignments, planCable } from '../design/cable-assign';
import { PSU_GROUP_ID } from '../device/ports';
import { computeRackMetrics } from '../design/metrics';
import { designIssues } from '../design/issues';
import { footprintTiles } from '../rack/side-elements';
import { migrateProjectJson } from '../project/migrate';
import { normalizeProject } from '../project/serializer';

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('GPU compute generations, MGX power shelves, 2RU 3-phase PDU, and racks', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());

  it('ships all four GPU compute generations with valid profiles, optics, and port ordering', () => {
    expect(lib.devices.get('gpu-tray-1ru-lc')).toBeUndefined();

    const server8u = lib.devices.get('gpu-server-8ru-4x800g')!;
    expect(server8u).toMatchObject({
      name: '8RU 8-GPU Server (4x800G OSFP)',
      category: 'server',
      height: { units: 8, system: 'RU' },
      depthMm: 897,
      weightKg: 130,
      power: { typicalW: 8500, maxW: 10200 },
      psus: { count: 6, inlet: 'C20', ratedW: 3300 },
      defaultProfileId: 'default',
    });
    expect(server8u.ports.map((g) => [g.id, g.face, g.role, g.formFactor, g.count, g.speedGbps, g.heatSink])).toEqual([
      ['be', 'rear', 'data', 'OSFP', 4, 800, 'IHS'],
      ['fe', 'rear', 'data', 'QSFP112', 4, 400, undefined],
      ['ibmgmt', 'rear', 'data', 'QSFP28', 2, 100, undefined],
      ['bmc', 'rear', 'mgmt', 'RJ45', 1, 1, undefined],
      ['lom', 'rear', 'mgmt', 'RJ45', 1, 10, undefined],
    ]);

    const tray400 = lib.devices.get('gpu-tray-1ru-lc-4x400g')!;
    expect(tray400).toMatchObject({
      name: '1RU Liquid-Cooled GPU Compute Tray (4x400G OSFP)',
      category: 'server',
      height: { units: 1, system: 'RU' },
      depthMm: 800,
      weightKg: 32,
      power: { typicalW: 5400, maxW: 6600 },
      defaultProfileId: 'default',
    });
    expect(tray400.psus).toBeUndefined();
    expect(tray400.ports.map((g) => [g.id, g.face, g.role, g.formFactor, g.count, g.speedGbps])).toEqual([
      ['be', 'front', 'data', 'OSFP', 4, 400],
      ['fe', 'front', 'data', 'QSFP112', 4, 400],
      ['bmc', 'front', 'mgmt', 'RJ45', 3, 1],
      ['lom', 'front', 'mgmt', 'RJ45', 1, 1],
    ]);

    const tray800 = lib.devices.get('gpu-tray-1ru-lc-4x800g')!;
    expect(tray800).toMatchObject({
      name: '1RU Liquid-Cooled GPU Compute Tray (4x800G OSFP)',
      category: 'server',
      height: { units: 1, system: 'RU' },
      depthMm: 800,
      weightKg: 34,
      power: { typicalW: 6200, maxW: 7400 },
      defaultProfileId: 'default',
    });
    expect(tray800.psus).toBeUndefined();
    expect(tray800.ports.map((g) => [g.id, g.face, g.role, g.formFactor, g.count, g.speedGbps])).toEqual([
      ['be', 'front', 'data', 'OSFP', 4, 800],
      ['fe', 'front', 'data', 'QSFP112', 2, 400],
      ['bmc', 'front', 'mgmt', 'RJ45', 2, 1],
      ['lom', 'front', 'mgmt', 'RJ45', 1, 1],
    ]);

    const tray1600 = lib.devices.get('gpu-tray-1ru-lc-4x1600g')!;
    expect(tray1600).toMatchObject({
      name: '1RU Liquid-Cooled GPU Compute Tray (4x1.6T OSFP)',
      category: 'server',
      height: { units: 1, system: 'RU' },
      depthMm: 800,
      weightKg: 36,
      power: { typicalW: 9000, maxW: 11000 },
      defaultProfileId: 'default',
    });
    expect(tray1600.psus).toBeUndefined();
    expect(tray1600.ports.map((g) => [g.id, g.face, g.role, g.formFactor, g.count, g.speedGbps])).toEqual([
      ['be', 'front', 'data', 'OSFP', 4, 1600],
      ['fe', 'front', 'data', 'QSFP112', 2, 400],
      ['bmc', 'front', 'mgmt', 'RJ45', 2, 1],
      ['lom', 'front', 'mgmt', 'RJ45', 1, 1],
    ]);

    // Every profile on all four compute devices validates cleanly and resolves its declared optics.
    const extraOptics: [string, string, string, string][] = [
      ['gpu-server-8ru-4x800g', 'be-2x400g', 'be/1', 'osfp-800g-2xdr4-ihs'],
      ['gpu-tray-1ru-lc-4x400g', 'fe-200g', 'fe/1', 'qsfp56-200g-dr4'],
      ['gpu-tray-1ru-lc-4x800g', 'be-2x400g', 'be/1', 'osfp-800g-2xdr4'],
      ['gpu-tray-1ru-lc-4x1600g', 'be-2x800g', 'be/1', 'osfp-1600g-2xdr4'],
    ];
    for (const [devId, profId, portRef, expectedOpticId] of extraOptics) {
      const d = lib.devices.get(devId)!;
      for (const prof of d.breakoutProfiles) {
        expect(validateProfile(d, prof), `${devId}:${prof.id}`).toEqual([]);
      }
      const prof = d.breakoutProfiles.find((p) => p.id === profId)!;
      const resolved = resolvePort(lib, d, portRef, prof)!;
      expect(resolved.optic?.id, `${devId}:${profId}`).toBe(expectedOpticId);
    }
  });

  it('ships updated scale-up switch tray, 110kW & 33kW MGX power shelves, and 2RU 3-phase PDU', () => {
    const swTray = lib.devices.get('scaleup-switch-tray-1ru-lc')!;
    expect(swTray).toMatchObject({
      depthMm: 800,
      weightKg: 24,
      power: { typicalW: 650, maxW: 800 },
    });
    expect(dataPorts(swTray)).toEqual([]);

    const ps110 = lib.devices.get('power-shelf-mgx-110kw')!;
    expect(ps110).toMatchObject({
      weightKg: 55,
      power: { typicalW: 0, maxW: 0, capacityW: 109800 },
      psus: { count: 6, inlet: 'Busbar', ratedW: 18300, layout: 'row' },
    });
    expect(ps110.ports.map((g) => [g.id, g.face, g.role, g.count, g.speedGbps])).toEqual([
      ['bmc', 'front', 'mgmt', 1, 1],
      ['sync', 'rear', 'mgmt', 2, 0],
    ]);

    const ps33 = lib.devices.get('power-shelf-mgx-33kw')!;
    expect(ps33).toMatchObject({
      name: '1RU 33kW Power Shelf',
      category: 'power-shelf',
      height: { units: 1, system: 'RU' },
      depthMm: 800,
      weightKg: 22,
      power: { typicalW: 0, maxW: 0, capacityW: 33000 },
      psus: { count: 6, inlet: 'Busbar', ratedW: 5500, layout: 'row' },
    });
    expect(ps33.ports.map((g) => [g.id, g.face, g.role, g.count, g.speedGbps])).toEqual([
      ['bmc', 'front', 'mgmt', 1, 1],
      ['sync', 'rear', 'mgmt', 2, 0],
    ]);

    const pdu2u = lib.devices.get('pdu-horizontal-2ru-3ph')!;
    expect(pdu2u).toMatchObject({
      name: '2RU 3-Phase PDU 34.6kW 415V 60A',
      category: 'pdu',
      height: { units: 2, system: 'RU' },
      depthMm: 450,
      weightKg: 14,
      power: { typicalW: 0, maxW: 0, capacityW: 34600 },
      pdu: { phases: 3, voltageV: 415, inputCurrentA: 60, inputPlug: 'IEC 60309 3P+N+E 60A (560P6)' },
    });
    expect(pdu2u.ports.map((g) => [g.id, g.face, g.role, g.formFactor, g.count, g.phase, g.breakerA])).toEqual([
      ['bank-a-c19', 'rear', 'outlet', 'C19', 4, 'L1-L2', 20],
      ['bank-b-c19', 'rear', 'outlet', 'C19', 4, 'L2-L3', 20],
      ['bank-c-c19', 'rear', 'outlet', 'C19', 4, 'L3-L1', 20],
      ['mgmt', 'rear', 'mgmt', 'RJ45', 1, undefined, undefined],
      ['sensor', 'rear', 'console', 'RJ45', 2, undefined, undefined],
    ]);
    expect(dataPorts(pdu2u)).toEqual([]);

    for (const rId of ['mgx-48ru', 'mgx-48ru-pdu-sidepods']) {
      expect(lib.racks.get(rId)).toMatchObject({ maxPowerW: 240000, maxLoadKg: 2500 });
    }
    const srvRack = lib.racks.get('server-48ru-800')!;
    expect(srvRack).toMatchObject({
      name: 'Server Rack 48RU (800mm, w/ PDU Bays)',
      kind: 'server',
      units: 48,
      unitSystem: 'RU',
      widthMm: 800,
      depthMm: 1200,
      heightMm: 2260,
      emptyWeightKg: 180,
      maxLoadKg: 1500,
      maxPowerW: 50000,
    });
    expect(footprintTiles(srvRack)).toEqual({ wide: 1.5, deep: 2 });
  });

  it('resolves unprefixed p1..p4 to backend (be/1..4) and fe1..feN to frontend (fe/1..N) across all compute devices', () => {
    for (const id of [
      'gpu-server-8ru-4x800g',
      'gpu-tray-1ru-lc-4x400g',
      'gpu-tray-1ru-lc-4x800g',
      'gpu-tray-1ru-lc-4x1600g',
    ]) {
      const d = lib.devices.get(id)!;
      const data = dataPorts(d);
      // Every data/mgmt/console port group id ends with a letter so `portNumber` never merges group digits with port index.
      for (const g of d.ports.filter((p) => p.role !== 'outlet')) {
        expect(g.id, `${id}:${g.id}`).toMatch(/[a-z]$/i);
      }
      expect(cageOf(d, data, 'p1')?.ref, id).toBe('be/1');
      expect(cageOf(d, data, 'p4')?.ref, id).toBe('be/4');
      expect(cageOf(d, data, 'fe1')?.ref, id).toBe('fe/1');
      expect(cageOf(d, data, 'fe2')?.ref, id).toBe('fe/2');
      // Management RJ45 ports are excluded from `dataPorts`.
      expect(data.every((p) => p.group.role === 'data'), id).toBe(true);
    }
    const srv = lib.devices.get('gpu-server-8ru-4x800g')!;
    const srvData = dataPorts(srv);
    expect(srvData).toHaveLength(10); // 4 be + 4 fe + 2 ibmgmt
    expect(cageOf(srv, srvData, 'ibmgmt1')?.ref).toBe('ibmgmt/1');
    expect(cageOf(srv, srvData, 'ibmgmt2')?.ref).toBe('ibmgmt/2');
  });

  it('produces zero overlapping port or PSU boxes on both faces of every shipped device', () => {
    for (const d of SHIPPED_CATALOG.devices) {
      const f0 = layoutFace(d, 'front');
      const r0 = layoutFace(d, 'rear');
      const sharedW = Math.max(f0.width, r0.width);
      for (const face of ['front', 'rear'] as const) {
        const layout = layoutFace(d, face, sharedW);
        const boxes: { tag: string; box: Box }[] = [
          ...layout.ports.map((p) => ({ tag: p.ref, box: p })),
          ...layout.psus.map((p, i) => ({ tag: `psu/${i + 1}`, box: p })),
        ];
        for (const { tag, box } of boxes) {
          expect(box.x, `${d.id} ${face} ${tag}`).toBeGreaterThanOrEqual(0);
          expect(box.y, `${d.id} ${face} ${tag}`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.w, `${d.id} ${face} ${tag}`).toBeLessThanOrEqual(layout.width);
          expect(box.y + box.h, `${d.id} ${face} ${tag}`).toBeLessThanOrEqual(layout.height);
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(
              boxesOverlap(boxes[i].box, boxes[j].box),
              `${d.id} ${face}: ${boxes[i].tag} overlaps ${boxes[j].tag}`,
            ).toBe(false);
          }
        }
        for (const p of layout.ports) {
          if (p.group.role === 'mgmt' || p.group.role === 'console' || p.group.role === 'outlet') {
            expect({ w: p.w, h: p.h }, `${d.id} ${p.ref}`).toEqual(SMALL_PORT);
          }
        }
      }
    }
  });

  it('assembles a 4-server 800mm rack with 2x 2RU 3-phase PDUs and 24 C19-C20 cords with zero design issues', () => {
    const design = newDesign('gpu-8ru-rack', '8RU GPU Rack', 'server-48ru-800');
    const pdu1 = newPlacement('pdu1', 'pdu-horizontal-2ru-3ph', 'PDU1', { kind: 'rack', position: 1, face: 'front' });
    const pdu2 = newPlacement('pdu2', 'pdu-horizontal-2ru-3ph', 'PDU2', { kind: 'rack', position: 3, face: 'front' });
    design.placements.push(pdu1, pdu2);
    const servers = Array.from({ length: 4 }, (_, s) =>
      newPlacement(`srv${s + 1}`, 'gpu-server-8ru-4x800g', `GPU${s + 1}`, {
        kind: 'rack',
        position: 5 + s * 9,
        face: 'front',
      }),
    );
    design.placements.push(...servers);

    // Rear face exposes all 24 C19 outlets across the two 2RU PDUs and all 24 C20 PSU inlets across the four 8RU servers.
    const outlets = [pdu1, pdu2].flatMap((pdu) =>
      placementConnectors(lib, design, pdu, 'rear').filter((e) => e.portRef.startsWith('bank-')),
    );
    const inlets = servers.flatMap((srv) =>
      placementConnectors(lib, design, srv, 'rear').filter((e) => e.portRef.startsWith(`${PSU_GROUP_ID}/`)),
    );
    expect(outlets).toHaveLength(24);
    expect(inlets).toHaveLength(24);
    expect(outlets.every((e) => e.connector === undefined)).toBe(true);
    expect(inlets.every((e) => e.connector === undefined)).toBe(true);
    expect(applicableCables(lib, design, [inlets[0]], [outlets[0]]).map((c) => c.id)).toEqual(['power-c19-c20']);
    expect(planCable(lib, design, [inlets[0]], [outlets[0]], 'power-c19-c20', 'left').reversed).toBeFalsy();

    const leftPlan = planAssignments(lib, design, inlets.slice(0, 12), outlets.slice(0, 12), 'power-c19-c20', 'left');
    expect(leftPlan.error).toBeUndefined();
    design.cables.push(...leftPlan.runs.map((r, i) => ({ ...r, id: `pwr-l-${i + 1}` })));

    const rightPlan = planAssignments(lib, design, inlets.slice(12), outlets.slice(12), 'power-c19-c20', 'right');
    expect(rightPlan.error).toBeUndefined();
    design.cables.push(...rightPlan.runs.map((r, i) => ({ ...r, id: `pwr-r-${i + 1}` })));

    expect(design.cables).toHaveLength(24);
    const metrics = computeRackMetrics(lib, design);
    expect(metrics.usedUnits).toBe(36);
    expect(metrics.maxW).toBe(40800);
    expect(metrics.supplyCapacityW).toBe(69200);
    expect(metrics.deviceWeightKg).toBe(548);
    expect(metrics.warnings).toEqual([]);
    expect(designIssues(lib, design).count).toBe(0);
  });

  it('migrates gpu-tray-1ru-lc across all 6 project sites in migrateProjectJson and normalizeProject', () => {
    const topoBlockYaml = [
      'topology: mgx-pod',
      'version: 1',
      'device_set_groups:',
      '  compute:',
      '    role: GPU tray',
      '    count: 72',
      '    device_type: gpu-tray-1ru-lc   # legacy tray id',
      '    ports:',
      '      be: p{1-4}',
      '      fe: fe{1-2}',
      '  aux: { role: Canary, count: 2, device_type: gpu-tray-1ru-lc, ports: { be: p{1-4} } }',
      '',
    ].join('\n');

    const raw = {
      name: 'Legacy MGX Project',
      hiddenBuiltins: ['gpu-tray-1ru-lc', 'gpu-tray-1ru-lc--generic'],
      variants: [
        {
          id: 'gpu-tray-1ru-lc--generic',
          name: 'Legacy Generic Tray',
          target: 'device',
          itemId: 'gpu-tray-1ru-lc',
          vendor: 'Generic',
          model: 'Legacy Generic Tray',
          properties: { sku: 'GEN-1' },
        },
        {
          id: 'custom-tray-v1',
          name: 'Custom Tray SKU',
          target: 'device',
          itemId: 'gpu-tray-1ru-lc',
          vendor: 'Custom',
          model: 'CT-1',
        },
      ],
      builtinProperties: {
        'gpu-tray-1ru-lc': { assetTag: 'OLD-TYPE' },
        'gpu-tray-1ru-lc--generic': { sku: 'OLD-GENERIC' },
      },
      builtinProfiles: {
        'gpu-tray-1ru-lc': {
          defaultProfileId: 'be-2x800g',
          breakoutProfiles: [
            { id: 'default', name: 'Default', groupDefaults: {}, overrides: {} },
            {
              id: 'be-2x800g',
              name: 'Dual-plane 2x800G',
              groupDefaults: { be: { mode: '2x800G', reach: '2xDR4-2' } },
              overrides: {},
            },
          ],
        },
      },
      rackDesigns: [
        {
          id: 'r1',
          name: 'MGX Rack 1',
          templateId: 'mgx-48ru',
          placements: [
            {
              id: 't1',
              deviceId: 'gpu-tray-1ru-lc',
              label: 'SRV1',
              mount: { kind: 'rack', position: 1, face: 'front' },
              portSettings: {},
              groupSettings: {},
            },
          ],
          bomItems: {
            'gpu-tray-1ru-lc': 'gpu-tray-1ru-lc--generic',
          },
          bomSiAdjustable: {
            'gpu-tray-1ru-lc': true,
          },
          cables: [],
        },
      ],
      topologies: [
        {
          id: 'topo-1',
          name: 'MGX Pod',
          source: topoBlockYaml,
          bom: {
            items: {
              'gpu-tray-1ru-lc': 'gpu-tray-1ru-lc--generic',
            },
          },
        },
        {
          id: 'topo-draft',
          name: 'Draft',
          source: '# comment: device_type: gpu-tray-1ru-lc\ndevice_set_groups:\n  broken: [unclosed\n  c:\n    device_type: "gpu-tray-1ru-lc" # keep comment\n  proto:\n    device_type: constructor\n',
          bom: {
            devices: { c: 'gpu-tray-1ru-lc' },
            items: { 'gpu-tray-1ru-lc': 'custom-tray-v1' },
          },
        },
      ],
    };

    // Check `hiddenBuiltins` rename (and Object.prototype key safety) directly on `migrateProjectJson`.
    const migratedRaw = migrateProjectJson({
      ...raw,
      hiddenBuiltins: [...raw.hiddenBuiltins, 'constructor', 'constructor--generic'],
    });
    expect(migratedRaw.hiddenBuiltins).toEqual([
      'gpu-tray-1ru-lc-4x1600g',
      'gpu-tray-1ru-lc-4x1600g--generic',
      'constructor',
      'constructor--generic',
    ]);

    const project = normalizeProject(raw);

    // 1. placements & variants (itemId + --generic id)
    expect(project.rackDesigns[0].placements[0].deviceId).toBe('gpu-tray-1ru-lc-4x1600g');
    expect(project.variants.map((v) => [v.id, v.itemId])).toEqual([
      ['gpu-tray-1ru-lc-4x1600g--generic', 'gpu-tray-1ru-lc-4x1600g'],
      ['custom-tray-v1', 'gpu-tray-1ru-lc-4x1600g'],
    ]);

    // 2. builtinProperties (plain & --generic keys)
    expect(project.builtinProperties).toEqual({
      'gpu-tray-1ru-lc-4x1600g': { assetTag: 'OLD-TYPE' },
      'gpu-tray-1ru-lc-4x1600g--generic': { sku: 'OLD-GENERIC' },
    });

    // 3. rackDesigns[].bomItems (key & --generic value) & rackDesigns[].bomSiAdjustable
    expect(project.rackDesigns[0].bomItems).toEqual({
      'gpu-tray-1ru-lc-4x1600g': 'gpu-tray-1ru-lc-4x1600g--generic',
    });
    expect(project.rackDesigns[0].bomSiAdjustable).toEqual({
      'gpu-tray-1ru-lc-4x1600g': true,
    });

    // 4. builtinProfiles keys (plus reach rename `2xDR4-2` -> `2xDR4+`)
    expect(Object.keys(project.builtinProfiles)).toEqual(['gpu-tray-1ru-lc-4x1600g']);
    expect(project.builtinProfiles['gpu-tray-1ru-lc-4x1600g'].breakoutProfiles[1].groupDefaults.be.reach).toBe('2xDR4+');

    // 5. topologies[].bom.items (both current & legacy bom shapes)
    expect(project.topologies[0].bom?.items).toEqual({
      'gpu-tray-1ru-lc-4x1600g': 'gpu-tray-1ru-lc-4x1600g--generic',
    });
    expect(project.topologies[1].bom?.items).toEqual({
      'gpu-tray-1ru-lc-4x1600g': 'custom-tray-v1',
    });

    // 6. topologies[].source (block line with comment preserved, inline flow entry, and draft fallback)
    const migratedSrc = project.topologies[0].source;
    expect(migratedSrc).toContain('    device_type: gpu-tray-1ru-lc-4x1600g   # legacy tray id');
    expect(migratedSrc).toContain('device_type: gpu-tray-1ru-lc-4x1600g, ports:');
    expect(migratedSrc).not.toMatch(/gpu-tray-1ru-lc(?!-4x1600g)/);
    expect(project.topologies[1].source).toContain('# comment: device_type: gpu-tray-1ru-lc');
    expect(project.topologies[1].source).toContain('device_type: "gpu-tray-1ru-lc-4x1600g" # keep comment');
    expect(project.topologies[1].source).toContain('device_type: constructor\n');

    // Migrated topology compiles cleanly against the shipped catalog with zero hardware problems.
    const vt = parseVirtual(migratedSrc);
    expect(vt.problems).toEqual([]);
    const hw = topoHardware(new Library(SHIPPED_CATALOG, project, [], project.builtinProperties, project.builtinProfiles), vt);
    for (const g of hw.values()) expect(g.problems).toEqual([]);
  });
});
