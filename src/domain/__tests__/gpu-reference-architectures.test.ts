import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOG } from './catalog-fixture';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { layoutFace, type Box } from '../../features/devices/drawing/faceplate-layout';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { applicableCables, placementConnectors, planAssignments } from '../design/cable-assign';
import { PSU_GROUP_ID } from '../device/ports';
import { computeRackMetrics } from '../design/metrics';
import { designIssues } from '../design/issues';
import { parseVirtual, portNumber } from '../topo/virtual';
import { hardwareProblems, topoHardware } from '../topo/hardware';
import { estimateTopoBom } from '../topo/bom';
import type { Placement } from '../design/types';

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function assertFaceHasNoOverlaps(deviceId: string) {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());
  const device = lib.devices.get(deviceId);
  expect(device, `missing device ${deviceId}`).toBeDefined();
  const f0 = layoutFace(device!, 'front');
  const r0 = layoutFace(device!, 'rear');
  const sharedW = Math.max(f0.width, r0.width);
  for (const face of ['front', 'rear'] as const) {
    const layout = layoutFace(device!, face, sharedW);
    const boxes: { tag: string; box: Box }[] = [
      ...layout.ports.map((p) => ({ tag: p.ref, box: p })),
      ...layout.psus.map((p, i) => ({ tag: `psu/${i + 1}`, box: p })),
    ];
    for (const { tag, box } of boxes) {
      expect(box.x, `${deviceId} ${face} ${tag}`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${deviceId} ${face} ${tag}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w, `${deviceId} ${face} ${tag}`).toBeLessThanOrEqual(layout.width + 1e-6);
      expect(box.y + box.h, `${deviceId} ${face} ${tag}`).toBeLessThanOrEqual(layout.height + 1e-6);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(
          boxesOverlap(boxes[i].box, boxes[j].box),
          `${deviceId} (${face}) overlap between ${boxes[i].tag} and ${boxes[j].tag}`,
        ).toBe(false);
      }
    }
  }
}

/** Assemble a full 48RU 18-tray MGX liquid-cooled rack with busbar OOB switches, OOB Cat6A cabling, and rear shelf sync chain. */
function buildMgx18TrayRack(
  lib: Library,
  opts: {
    id: string;
    trayDeviceId: string;
    shelfDeviceId: 'power-shelf-mgx-33kw' | 'power-shelf-mgx-110kw';
    shelfCount: 8 | 4;
  },
) {
  const design = newDesign(opts.id, opts.id, 'mgx-48ru');
  let u = 1;

  const place = (id: string, deviceId: string, label: string): Placement => {
    const dev = lib.devices.get(deviceId)!;
    const p = newPlacement(id, deviceId, label, { kind: 'rack', position: u, face: 'front' });
    u += dev.height.units;
    design.placements.push(p);
    return p;
  };

  const bottomShelves = opts.shelfCount / 2;
  const shelves: Placement[] = [];
  for (let i = 1; i <= bottomShelves; i++) {
    shelves.push(place(`ps${i}`, opts.shelfDeviceId, `PS${i}`));
  }

  const trays: Placement[] = [];
  for (let i = 1; i <= 10; i++) {
    trays.push(place(`gpu${i}`, opts.trayDeviceId, `GPU${i}`));
  }

  const swTrays: Placement[] = [];
  for (let i = 1; i <= 9; i++) {
    swTrays.push(place(`susw${i}`, 'scaleup-switch-tray-1ru-lc', `SU-SW${i}`));
  }

  for (let i = 11; i <= 18; i++) {
    trays.push(place(`gpu${i}`, opts.trayDeviceId, `GPU${i}`));
  }

  for (let i = bottomShelves + 1; i <= opts.shelfCount; i++) {
    shelves.push(place(`ps${i}`, opts.shelfDeviceId, `PS${i}`));
  }

  // Place the two 1RU busbar OOB management switches at the top of the 48RU rack (U47 and U48).
  expect(u).toBeLessThanOrEqual(47);
  const oob1 = newPlacement('oob1', 'switch-48x1g-4x100g-mgmt-dc', 'OOB1', { kind: 'rack', position: 47, face: 'front' });
  const oob2 = newPlacement('oob2', 'switch-48x1g-4x100g-mgmt-dc', 'OOB2', { kind: 'rack', position: 48, face: 'front' });
  design.placements.push(oob1, oob2);

  // Collect all front OOB endpoints (compute tray BMC + LOM, scale-up switch BMC, power shelf BMC).
  const frontOobEndpoints = [
    ...trays.flatMap((t) =>
      placementConnectors(lib, design, t, 'front').filter(
        (e) => e.portRef.startsWith('bmc/') || e.portRef.startsWith('lom/'),
      ),
    ),
    ...swTrays.flatMap((sw) =>
      placementConnectors(lib, design, sw, 'front').filter((e) => e.portRef === 'bmc/1'),
    ),
    ...shelves.flatMap((ps) =>
      placementConnectors(lib, design, ps, 'front').filter((e) => e.portRef === 'bmc/1'),
    ),
  ];

  const oobSwitchPorts = [oob1, oob2].flatMap((sw) =>
    placementConnectors(lib, design, sw, 'front').filter((e) => e.portRef.startsWith('copper/')),
  );
  expect(oobSwitchPorts).toHaveLength(96);
  expect(frontOobEndpoints.length).toBeLessThanOrEqual(oobSwitchPorts.length);

  const oobPlan = planAssignments(
    lib,
    design,
    frontOobEndpoints,
    oobSwitchPorts.slice(0, frontOobEndpoints.length),
    'cat6a',
    'right',
  );
  expect(oobPlan.error).toBeUndefined();
  design.cables.push(...oobPlan.runs.map((r, i) => ({ ...r, id: `oob-cat6a-${i + 1}` })));

  // Rear shelf current-share / sync daisy-chain: PS[i] sync/2 -> PS[i+1] sync/1.
  const syncFrom = shelves.slice(0, -1).map(
    (ps) => placementConnectors(lib, design, ps, 'rear').find((e) => e.portRef === 'sync/2')!,
  );
  const syncTo = shelves.slice(1).map(
    (ps) => placementConnectors(lib, design, ps, 'rear').find((e) => e.portRef === 'sync/1')!,
  );
  const syncPlan = planAssignments(lib, design, syncFrom, syncTo, 'cat6a', 'left');
  expect(syncPlan.error).toBeUndefined();
  design.cables.push(...syncPlan.runs.map((r, i) => ({ ...r, id: `ps-sync-${i + 1}` })));

  return {
    design,
    oobRunCount: oobPlan.runs.length,
    syncRunCount: syncPlan.runs.length,
  };
}

describe('Management/fabric switches, 800G DR4+ optics, and 4-gen rack/SU reference architectures', () => {
  const lib = new Library(SHIPPED_CATALOG, emptyProject());

  describe('shipped catalog optics, switches, port group naming, and faceplate geometry', () => {
    it('ships 800G OSFP DR4+ (MPO-12) optics in both RHS and IHS variants', () => {
      const rhs = lib.optics.get('osfp-800g-dr4');
      const ihs = lib.optics.get('osfp-800g-dr4-ihs');
      expect(rhs).toMatchObject({
        id: 'osfp-800g-dr4',
        name: '800G OSFP DR4+ RHS',
        packaging: 'module',
        formFactor: 'OSFP',
        heatSink: 'RHS',
        speedGbps: 800,
        reach: 'DR4+',
        fiberConnector: 'MPO-12',
        reachM: 2000,
        powerW: 0,
      });
      expect(ihs).toMatchObject({
        id: 'osfp-800g-dr4-ihs',
        name: '800G OSFP DR4+ IHS',
        packaging: 'module',
        formFactor: 'OSFP',
        heatSink: 'IHS',
        speedGbps: 800,
        reach: 'DR4+',
        fiberConnector: 'MPO-12',
        reachM: 2000,
        powerW: 0,
      });
    });

    it('ships all 5 new management and fabric switches with letter-suffixed port group IDs and empty default profiles', () => {
      const newSwitchIds = [
        'switch-48x1g-4x100g-mgmt',
        'switch-48x1g-4x100g-mgmt-dc',
        'switch-32x800g-osfp',
        'switch-72x1600g-osfp',
        'switch-72x1600g-osfp-lc',
      ] as const;

      for (const id of newSwitchIds) {
        const sw = lib.devices.get(id);
        expect(sw, `missing switch ${id}`).toBeDefined();
        expect(sw!.defaultProfileId).toBe('default');
        const def = sw!.breakoutProfiles.find((p) => p.id === 'default');
        expect(def).toMatchObject({ groupDefaults: {}, overrides: {} });
        for (const g of sw!.ports) {
          expect(g.id, `${id} port group "${g.id}" must end in a letter`).toMatch(/[a-z]$/);
          expect(portNumber(`${g.id}1`)).toEqual({ prefix: g.id, n: 1 });
        }
        assertFaceHasNoOverlaps(id);
      }

      expect(lib.devices.get('switch-48x1g-4x100g-mgmt-dc')!.psus).toBeUndefined();
      expect(lib.devices.get('switch-72x1600g-osfp-lc')!.psus).toBeUndefined();
      expect(lib.devices.get('switch-72x1600g-osfp-lc')!.ports.find((p) => p.id === 'osfp')!.heatSink).toBeUndefined();
      expect(lib.devices.get('switch-72x1600g-osfp')!.ports.find((p) => p.id === 'osfp')!.heatSink).toBe('IHS');
    });

    it('populates consistent power/weight specs and all-4x200g breakout profiles on existing switches', () => {
      const expectedSpecs: Record<string, { typicalW: number; maxW: number; weightKg: number }> = {
        'switch-64x800g-osfp': { typicalW: 1600, maxW: 2800, weightKg: 28 },
        'switch-64x800g-osfp-4psu': { typicalW: 1600, maxW: 2800, weightKg: 31 },
        'switch-64x1600g-osfp': { typicalW: 2200, maxW: 3800, weightKg: 34 },
        'switch-64x100g-qsfp28': { typicalW: 350, maxW: 650, weightKg: 18 },
        'switch-48x1g-mgmt': { typicalW: 45, maxW: 90, weightKg: 4.2 },
      };
      for (const [id, spec] of Object.entries(expectedSpecs)) {
        const sw = lib.devices.get(id)!;
        expect({ typicalW: sw.power.typicalW, maxW: sw.power.maxW, weightKg: sw.weightKg }).toEqual(spec);
        assertFaceHasNoOverlaps(id);
      }
      for (const id of ['switch-64x800g-osfp', 'switch-64x800g-osfp-4psu']) {
        const p = lib.devices.get(id)!.breakoutProfiles.find((bp) => bp.id === 'all-4x200g');
        expect(p).toEqual({
          id: 'all-4x200g',
          name: 'All 4x200G, 2xDR4+',
          groupDefaults: { osfp: { mode: '4x200G', reach: '2xDR4+' } },
          overrides: {},
        });
      }
    });
  });

  describe('4-generation full 48RU rack designs with zero designIssues', () => {
    it('Gen 1: assembles a 4x 8RU GPU server rack in server-48ru-800 with 2x 2RU 3-phase PDUs, OOB switch, and 24 C19-C20 cords', () => {
      const design = newDesign('gen1-8ru-rack', 'Gen 1 8RU GPU Rack', 'server-48ru-800');
      const pdu1 = newPlacement('pdu1', 'pdu-horizontal-2ru-3ph', 'PDU1', { kind: 'rack', position: 1, face: 'front' });
      const pdu2 = newPlacement('pdu2', 'pdu-horizontal-2ru-3ph', 'PDU2', { kind: 'rack', position: 3, face: 'front' });
      const oob = newPlacement('oob1', 'switch-48x1g-4x100g-mgmt', 'OOB1', { kind: 'rack', position: 48, face: 'front' });
      const servers = Array.from({ length: 4 }, (_, i) =>
        newPlacement(`srv${i + 1}`, 'gpu-server-8ru-4x800g', `GPU${i + 1}`, {
          kind: 'rack',
          position: 5 + i * 9,
          face: 'front',
        }),
      );
      design.placements.push(pdu1, pdu2, ...servers, oob);

      const outlets = [pdu1, pdu2].flatMap((pdu) =>
        placementConnectors(lib, design, pdu, 'rear').filter((e) => e.portRef.startsWith('bank-')),
      );
      const inlets = servers.flatMap((srv) =>
        placementConnectors(lib, design, srv, 'rear').filter((e) => e.portRef.startsWith(`${PSU_GROUP_ID}/`)),
      );
      expect(outlets).toHaveLength(24);
      expect(inlets).toHaveLength(24);
      expect(applicableCables(lib, design, [inlets[0]], [outlets[0]]).map((c) => c.id)).toEqual(['power-c19-c20']);

      const leftPwr = planAssignments(lib, design, inlets.slice(0, 12), outlets.slice(0, 12), 'power-c19-c20', 'left');
      expect(leftPwr.error).toBeUndefined();
      design.cables.push(...leftPwr.runs.map((r, i) => ({ ...r, id: `pwr-l-${i + 1}` })));

      const rightPwr = planAssignments(lib, design, inlets.slice(12), outlets.slice(12), 'power-c19-c20', 'right');
      expect(rightPwr.error).toBeUndefined();
      design.cables.push(...rightPwr.runs.map((r, i) => ({ ...r, id: `pwr-r-${i + 1}` })));

      // Wire all 10 rear OOB RJ45 ports (4 servers x [BMC + LOM] + 2 PDUs x MGMT) to front OOB switch copper ports.
      const rearMgmt = [
        ...servers.flatMap((srv) =>
          placementConnectors(lib, design, srv, 'rear').filter(
            (e) => e.portRef === 'bmc/1' || e.portRef === 'lom/1',
          ),
        ),
        ...[pdu1, pdu2].flatMap((pdu) =>
          placementConnectors(lib, design, pdu, 'rear').filter((e) => e.portRef === 'mgmt/1'),
        ),
      ];
      const oobCopper = placementConnectors(lib, design, oob, 'front')
        .filter((e) => e.portRef.startsWith('copper/'))
        .slice(0, rearMgmt.length);
      expect(rearMgmt).toHaveLength(10);
      const oobPlan = planAssignments(lib, design, rearMgmt, oobCopper, 'cat6a', 'right');
      expect(oobPlan.error).toBeUndefined();
      design.cables.push(...oobPlan.runs.map((r, i) => ({ ...r, id: `oob-${i + 1}` })));

      const metrics = computeRackMetrics(lib, design);
      expect(metrics.usedUnits).toBe(37);
      expect(metrics.warnings).toEqual([]);
      expect(designIssues(lib, design).count).toBe(0);
    });

    it('Gen 2: assembles a 4x400G 18-tray MGX rack with 9 switch trays, 8x33kW shelves, 2x busbar OOB switches, 89 OOB runs, and 7 sync links', () => {
      const { design, oobRunCount, syncRunCount } = buildMgx18TrayRack(lib, {
        id: 'gen2-mgx-4x400g',
        trayDeviceId: 'gpu-tray-1ru-lc-4x400g',
        shelfDeviceId: 'power-shelf-mgx-33kw',
        shelfCount: 8,
      });
      expect(oobRunCount).toBe(89);
      expect(syncRunCount).toBe(7);

      const metrics = computeRackMetrics(lib, design);
      expect(metrics.usedUnits).toBe(37);
      expect(metrics.supplyCapacityW).toBe(264000);
      expect(metrics.warnings).toEqual([]);
      expect(designIssues(lib, design).count).toBe(0);
    });

    it('Gen 3: assembles a 4x800G 18-tray MGX rack with 9 switch trays, 4x110kW shelves, 2x busbar OOB switches, 67 OOB runs, and 3 sync links', () => {
      const { design, oobRunCount, syncRunCount } = buildMgx18TrayRack(lib, {
        id: 'gen3-mgx-4x800g',
        trayDeviceId: 'gpu-tray-1ru-lc-4x800g',
        shelfDeviceId: 'power-shelf-mgx-110kw',
        shelfCount: 4,
      });
      expect(oobRunCount).toBe(67);
      expect(syncRunCount).toBe(3);

      const metrics = computeRackMetrics(lib, design);
      expect(metrics.usedUnits).toBe(41);
      expect(metrics.supplyCapacityW).toBe(439200);
      expect(metrics.warnings).toEqual([]);
      expect(designIssues(lib, design).count).toBe(0);
    });

    it('Gen 4: assembles a 4x1.6T 18-tray MGX rack with 9 switch trays, 4x110kW shelves, 2x busbar OOB switches, 67 OOB runs, and 3 sync links', () => {
      const { design, oobRunCount, syncRunCount } = buildMgx18TrayRack(lib, {
        id: 'gen4-mgx-4x1600g',
        trayDeviceId: 'gpu-tray-1ru-lc-4x1600g',
        shelfDeviceId: 'power-shelf-mgx-110kw',
        shelfCount: 4,
      });
      expect(oobRunCount).toBe(67);
      expect(syncRunCount).toBe(3);

      const metrics = computeRackMetrics(lib, design);
      expect(metrics.usedUnits).toBe(41);
      expect(metrics.maxW).toBe(205440);
      expect(metrics.supplyCapacityW).toBe(439200);
      expect(metrics.warnings).toEqual([]);
      expect(designIssues(lib, design).count).toBe(0);
    });
  });

  describe('5 1-SU Topo Builder topologies with zero problems and exact BOM counts', () => {
    it('SU 1: 8RU 2x400G (32 servers -> 8x 32x800G BE leaves, 2x 32x800G FE leaves, 2x 64x100G IB-mgmt leaves)', () => {
      const v = parseVirtual(`device_set_groups:
  compute:
    role: compute
    count: 32
    device_type: gpu-server-8ru-4x800g
    ports:
      be: { ports: "p{1-4}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
      fe: { ports: "fe{1-2}", optic: qsfp112-400g-dr4-2km, cable: mpo12-smf }
      ib: { ports: "ibmgmt{1-2}", optic: qsfp28-100g-psm4, cable: mpo12-smf }
  be_leaf:
    role: rail-leaf
    count: 8
    device_type: switch-32x800g-osfp
    ports:
      down: { ports: "osfp{1-16}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 2
    device_type: switch-32x800g-osfp
    ports:
      down: { ports: "osfp{1-16}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
  ib_leaf:
    role: ib-mgmt
    count: 2
    device_type: switch-64x100g-qsfp28
    ports:
      down: { ports: "etp{1-32}", optic: qsfp28-100g-psm4, cable: mpo12-smf }
topo:
  - { name: compute-be, from: { group: compute, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-fe, from: { group: compute, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-ib, from: { group: compute, ports: ib }, to: { group: ib_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
      expect(v.problems).toEqual([]);
      expect(hardwareProblems(lib, v)).toEqual([]);

      const bom = estimateTopoBom(lib, v, {});
      expect(bom.links).toBe(384);
      const qtyByKey = Object.fromEntries(bom.lines.map((l) => [l.key, l.qty]));
      expect(qtyByKey).toEqual({
        'device:gpu-server-8ru-4x800g': 32,
        'device:switch-32x800g-osfp': 10,
        'device:switch-64x100g-qsfp28': 2,
        'optic:osfp-800g-2xdr4-ihs': 288,
        'optic:qsfp112-400g-dr4-2km': 64,
        'optic:qsfp28-100g-psm4': 128,
        'cable:mpo12-smf': 384,
      });
      expect(bom.lines.filter((l) => l.kind === 'device').every((l) => l.unitW > 0)).toBe(true);
    });

    it('SU 2: 1RU 4x400G + 200G FE (72 trays -> 4x 64x800G 2x400G BE leaves + 2x 64x800G 4x200G FE leaves)', () => {
      const v = parseVirtual(`device_set_groups:
  compute:
    role: compute
    count: 72
    device_type: gpu-tray-1ru-lc-4x400g
    ports:
      be: { ports: "p{1-4}", optic: osfp-400g-dr4, cable: mpo12-smf }
      fe: { ports: "fe{1-2}", optic: qsfp56-200g-fr4, cable: lc-smf }
  be_leaf:
    role: rail-leaf
    count: 4
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "osfp{1-36}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 2
    device_type: switch-64x800g-osfp-4psu
    ports:
      down: { ports: "osfp{1-18}{a-d}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
topo:
  - { name: compute-be, from: { group: compute, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-fe, from: { group: compute, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
      expect(v.problems).toEqual([]);
      const hw = topoHardware(lib, v);
      expect(hardwareProblems(lib, v, hw)).toEqual([]);
      expect(hw.get('compute')!.profile?.id).toBe('fe-200g');
      expect(hw.get('be_leaf')!.profile?.id).toBe('all-2x400g');
      expect(hw.get('fe_leaf')!.profile?.id).toBe('all-4x200g');

      const bom = estimateTopoBom(lib, v, {});
      expect(bom.links).toBe(432);
      const qtyByKey = Object.fromEntries(bom.lines.map((l) => [l.key, l.qty]));
      expect(qtyByKey).toEqual({
        'device:gpu-tray-1ru-lc-4x400g': 72,
        'device:switch-64x800g-osfp': 4,
        'device:switch-64x800g-osfp-4psu': 2,
        'optic:osfp-400g-dr4': 288,
        'optic:qsfp56-200g-fr4': 144,
        'optic:osfp-800g-2xdr4-ihs': 180,
        'cable:mpo12-smf': 360,
        'cable:lc-smf': 144,
      });
    });

    it('SU 3: 1RU 4x800G single-plane DR4+ (72 trays with osfp-800g-dr4 -> 4x 72x1.6T 2x800G BE leaves + 2x 32x800G FE leaves)', () => {
      const v = parseVirtual(`device_set_groups:
  compute:
    role: compute
    count: 72
    device_type: gpu-tray-1ru-lc-4x800g
    ports:
      be: { ports: "p{1-4}", optic: osfp-800g-dr4, cable: mpo12-smf }
      fe: { ports: "fe{1-2}", optic: qsfp112-400g-dr4-2km, cable: mpo12-smf }
  be_leaf:
    role: rail-leaf
    count: 4
    device_type: switch-72x1600g-osfp
    ports:
      down: { ports: "osfp{1-36}{a,b}", optic: osfp-1600g-2xdr4-ihs, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 3
    device_type: switch-32x800g-osfp
    ports:
      down: { ports: "osfp{1-24}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
topo:
  - { name: compute-be, from: { group: compute, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-fe, from: { group: compute, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: round-robin, per_pair: 2 } }
`);
      expect(v.problems).toEqual([]);
      const hw = topoHardware(lib, v);
      expect(hardwareProblems(lib, v, hw)).toEqual([]);
      expect(hw.get('compute')!.profile?.id).toBe('default');
      expect(hw.get('be_leaf')!.profile?.id).toBe('all-2x800g');

      const bom = estimateTopoBom(lib, v, {});
      expect(bom.links).toBe(432);
      const qtyByKey = Object.fromEntries(bom.lines.map((l) => [l.key, l.qty]));
      expect(qtyByKey).toEqual({
        'device:gpu-tray-1ru-lc-4x800g': 72,
        'device:switch-72x1600g-osfp': 4,
        'device:switch-32x800g-osfp': 3,
        'optic:osfp-800g-dr4': 288,
        'optic:qsfp112-400g-dr4-2km': 144,
        'optic:osfp-1600g-2xdr4-ihs': 144,
        'optic:osfp-800g-2xdr4-ihs': 72,
        'cable:mpo12-smf': 432,
      });
    });

    it('SU 4: 1RU 4x800G dual-plane 2x400G (72 trays -> 8x 64x800G 2x400G BE leaves + 2x 72x1.6T 4x400G FE leaves)', () => {
      const v = parseVirtual(`device_set_groups:
  compute:
    role: compute
    count: 72
    device_type: gpu-tray-1ru-lc-4x800g
    ports:
      be: { ports: "p{1-4}{a,b}", optic: osfp-800g-2xdr4, cable: mpo12-smf }
      fe: { ports: "fe{1-2}", optic: qsfp112-400g-dr4-2km, cable: mpo12-smf }
  be_leaf:
    role: rail-leaf
    count: 8
    device_type: switch-64x800g-osfp
    ports:
      down: { ports: "osfp{1-36}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 2
    device_type: switch-72x1600g-osfp
    ports:
      down: { ports: "osfp{1-18}{a-d}", optic: osfp-1600g-2xdr4-ihs, cable: mpo12-smf }
topo:
  - { name: compute-be, from: { group: compute, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-fe, from: { group: compute, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
`);
      expect(v.problems).toEqual([]);
      const hw = topoHardware(lib, v);
      expect(hardwareProblems(lib, v, hw)).toEqual([]);
      expect(hw.get('compute')!.profile?.id).toBe('be-2x400g');
      expect(hw.get('be_leaf')!.profile?.id).toBe('all-2x400g');
      expect(hw.get('fe_leaf')!.profile?.id).toBe('all-4x400g');

      const bom = estimateTopoBom(lib, v, {});
      expect(bom.links).toBe(720);
      const qtyByKey = Object.fromEntries(bom.lines.map((l) => [l.key, l.qty]));
      expect(qtyByKey).toEqual({
        'device:gpu-tray-1ru-lc-4x800g': 72,
        'device:switch-64x800g-osfp': 8,
        'device:switch-72x1600g-osfp': 2,
        'optic:osfp-800g-2xdr4': 288,
        'optic:qsfp112-400g-dr4-2km': 144,
        'optic:osfp-800g-2xdr4-ihs': 288,
        'optic:osfp-1600g-2xdr4-ihs': 36,
        'cable:mpo12-smf': 720,
      });
    });

    it('SU 5: 1RU 4x1.6T dual-plane 2x800G (72 trays -> 8x 72x1.6T LC 2x800G BE leaves + 3x 32x800G FE leaves)', () => {
      const v = parseVirtual(`device_set_groups:
  compute:
    role: compute
    count: 72
    device_type: gpu-tray-1ru-lc-4x1600g
    ports:
      be: { ports: "p{1-4}{a,b}", optic: osfp-1600g-2xdr4, cable: mpo12-smf }
      fe: { ports: "fe{1-2}", optic: qsfp112-400g-dr4-2km, cable: mpo12-smf }
  be_leaf:
    role: rail-leaf
    count: 8
    device_type: switch-72x1600g-osfp-lc
    ports:
      down: { ports: "osfp{1-36}{a,b}", optic: osfp-1600g-2xdr4, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 3
    device_type: switch-32x800g-osfp
    ports:
      down: { ports: "osfp{1-24}{a,b}", optic: osfp-800g-2xdr4-ihs, cable: mpo12-smf }
topo:
  - { name: compute-be, from: { group: compute, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 1 } }
  - { name: compute-fe, from: { group: compute, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: round-robin, per_pair: 2 } }
`);
      expect(v.problems).toEqual([]);
      const hw = topoHardware(lib, v);
      expect(hardwareProblems(lib, v, hw)).toEqual([]);
      expect(hw.get('compute')!.profile?.id).toBe('be-2x800g');
      expect(hw.get('be_leaf')!.profile?.id).toBe('all-2x800g');

      const bom = estimateTopoBom(lib, v, {});
      expect(bom.links).toBe(720);
      const qtyByKey = Object.fromEntries(bom.lines.map((l) => [l.key, l.qty]));
      expect(qtyByKey).toEqual({
        'device:gpu-tray-1ru-lc-4x1600g': 72,
        'device:switch-72x1600g-osfp-lc': 8,
        'device:switch-32x800g-osfp': 3,
        'optic:osfp-1600g-2xdr4': 576,
        'optic:qsfp112-400g-dr4-2km': 144,
        'optic:osfp-800g-2xdr4-ihs': 72,
        'cable:mpo12-smf': 720,
      });
    });

    it('matches osfp-800g-dr4-ihs on IHS 800G ports and all-4x200g on switch-32x800g-osfp with zero hardware problems', () => {
      const v = parseVirtual(`device_set_groups:
  srv:
    role: compute
    count: 16
    device_type: gpu-server-8ru-4x800g
    ports:
      be: { ports: "p{1-4}", optic: osfp-800g-dr4-ihs, cable: mpo12-smf }
  tray:
    role: compute-tray
    count: 16
    device_type: gpu-tray-1ru-lc-4x400g
    ports:
      fe: { ports: "fe{1-2}", optic: qsfp56-200g-dr4, cable: mpo12-smf }
  be_leaf:
    role: rail-leaf
    count: 2
    device_type: switch-72x1600g-osfp
    ports:
      down: { ports: "osfp{1-16}{a,b}", optic: osfp-1600g-2xdr4-ihs, cable: mpo12-smf }
  fe_leaf:
    role: fe-leaf
    count: 1
    device_type: switch-32x800g-osfp
    ports:
      down: { ports: "osfp{1-8}{a-d}", optic: osfp-800g-2xdr4-ihs }
topo:
  - { name: srv-be, from: { group: srv, ports: be }, to: { group: be_leaf, ports: down }, pattern: { type: mesh, per_pair: 2 } }
  - { name: tray-fe, from: { group: tray, ports: fe }, to: { group: fe_leaf, ports: down }, pattern: { type: mesh, per_pair: 2 } }
`);
      expect(v.problems).toEqual([]);
      const hw = topoHardware(lib, v);
      expect(hardwareProblems(lib, v, hw)).toEqual([]);
      expect(hw.get('srv')!.profile?.id).toBe('default');
      expect(hw.get('tray')!.profile?.id).toBe('fe-200g');
      expect(hw.get('be_leaf')!.profile?.id).toBe('all-2x800g');
      expect(hw.get('fe_leaf')!.profile?.id).toBe('all-4x200g');
    });
  });
});
