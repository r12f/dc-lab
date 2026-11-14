# Devices (L10)

Single-device definitions. One device = one JSON file (`schema: "dc-lab/device@1"`).

## Device model

| Field | Meaning |
|---|---|
| `id`, `name`, `vendor`, `model` | Identity. `id` is unique across built-in + project. `model` is shown as **Model / Vendor PN**. |
| `properties` | Values of project-wide custom properties (see [05-project-file.md](05-project-file.md#custom-properties)) |
| `category` | `switch`, `server`, `pdu`, `patch-panel`, `ocs`, `power-shelf`, `storage`, `other` |
| `height` | `{ units, system: "RU" \| "OU" }`; `0` units = zero-U (vertical PDU, side-pod device) |
| `depthMm`, `weightKg` | Physical metrics |
| `power` | `{ typicalW, maxW, capacityW? }`. `capacityW` is set for power *suppliers* (PDU, power shelf). |
| `psus` | Optional `{ count, inlet, ratedW }` — hot-swap PSUs on the rear face |
| `pdu` | Optional PDU input: `{ phases, voltageV, inputCurrentA, inputPlug }` |
| `ports` | List of **port groups** |
| `breakoutProfiles` | Named per-port configurations |

### Category traits

Each category has traits used by the rest of the app (color, whether it supplies power, whether it may
mount zero-U in a side pod). Suppliers' `typicalW/maxW` is their own loss; `capacityW` counts toward
rack supply capacity.

### Port groups

A port group is a run of identical ports: `label`, `role`, `formFactor`, `count`, `speedGbps` (native),
`lanes`, `face` (front/rear), `rows` (layout rows on the faceplate), `breakoutModes`
(e.g. `["2x400G", "4x200G", "8x100G"]`; native `1x<speed>G` is implicit), and for fiber-connector
ports `opticalEngine` (`cpo` | `npo`).

### Form factors

The **form factor** of a port is fixed by the hardware. It comes from a registry
(`src/domain/ports/formFactors.ts`) with a `kind`:

| Kind | Examples | Meaning |
|---|---|---|
| `cage` | SFP28, SFP112, QSFP28, QSFP56, QSFP112, QSFP-DD, QSFP-DD800, OSFP, OSFP-XD, ELSFP | Pluggable module cage |
| `fiber` | LC, CS, SN, MPO-12, MPO-16, MMC | Fiber connector directly on the faceplate |
| `copper` | RJ45 | Fixed copper port |
| `power` | C13, C19 | Power outlet |

Cage compatibility: each cage lists the module form factors it accepts. A cage always accepts its
own form factor; backward-compatible cages accept older modules, e.g. QSFP-DD accepts QSFP56 /
QSFP28 / QSFP+, QSFP112 accepts QSFP56 / QSFP28, SFP112 accepts SFP56 / SFP28 / SFP+.
OSFP accepts OSFP only. A cage also offers the native speed of every accepted older form factor as an
extra mode (QSFP-DD 400G also offers `1x200G`, `1x100G`).

### Speed and reach are independent

For a pluggable cage the user chooses, per port or group:

1. **Speed / breakout** (`mode`, e.g. `2x400G`) — limited by the cage and its compatible form factors.
2. **Reach** (`reach`, e.g. `DR4`, `2xDR4`, `FR4`, `SR4`, `LR4`, `DAC`, `AOC`) — offered from the optic
   catalog for modules that fit the cage and run at the chosen total speed.
3. **Module** (`opticId`, optional) — when unset, the first catalog module matching
   cage + speed + reach is used automatically ("auto"). A specific module may be pinned.

Optic modules have `formFactor`, `speedGbps`, `reach`, `fiberConnector` (e.g. DR4 → MPO-12,
2xDR4 → 2x MPO-12, FR4 → LC), `reachM`, `powerW`. Cable choices are filtered to cables whose connector
matches the module's fiber connector (or the port's own connector for fiber ports) and whose fiber type
matches the reach (SR/VR = multimode, other optical reaches = single-mode). BOM cable quantity per port
follows the connector multiplier: a `2xDR4` module (`2x MPO-12`) needs two trunks.

### CPO and NPO ports

Co-packaged (CPO) and near-packaged (NPO) optics switches expose **fiber connectors** (MPO-16, MMC,
LC…) instead of cages. Such a group sets `opticalEngine: "cpo" | "npo"` and `reaches` (the optical
interfaces the engine supports, e.g. `["DR4", "2xDR4"]`). There is no module to choose: reach is
picked from `reaches`, the engine power is part of the device power, and cables must match the
port connector. CPO switches typically add an `ELSFP` cage group of role `laser` for external laser
source modules.

`role` is one of:

| Role | Use |
|---|---|
| `data` | Front-panel / NIC data ports |
| `mgmt` | Out-of-band management Ethernet (RJ45) |
| `console` | Serial console (RJ45) |
| `service` | Service/in-band ports, e.g. 2x 10G SFP+ on high-radix switches |
| `laser` | External laser source cages for CPO/NPO (ELSFP) |
| `outlet` | Power outlets (PDU, power shelf) |

PDU outlet groups additionally carry `bank` (e.g. `"A"`) and `phase` (`L1`, `L2`, `L3`, or `L1-L2`…).
A bank is a breaker-protected set of outlets on one phase (or phase pair).

Ports are addressed as `<groupId>/<index>` (1-based), e.g. `osfp/17`.

### PSUs

`psus.count` PSUs are drawn on the rear face, split evenly between the left and right edge
(2 PSUs = one per side; 4 PSUs = two per side). Each PSU shows its inlet (C14, C20, busbar).

### Breakout profiles

A profile stores a **port setting** per group (default) and per port (override):

```
PortSetting = { mode?: "4x200G", reach?: "2xDR4", opticId?: "osfp-800g-2xdr4", cableId?: "mpo12-smf" }
profile = { id, name, groupDefaults: { [groupId]: PortSetting }, overrides: { [portRef]: PortSetting } }
```

Each field resolves independently: instance override (Rack Designer) > profile port override >
profile group default > native mode / no optic / no cable. An optic is valid only if its form factor
fits the cage and its speed matches the mode.
The effective breakout and optic/cable are drawn on every port. Each data/service port shows, along
its bottom edge, one sub-box per **cable connector** on the port face: the module's fiber connectors
(`2xDR4` module with `2x MPO-12` → two MPO-12 boxes, `2xFR4` → two LC boxes, pigtail → one per leg) or,
for CPO/NPO fiber ports, the port connector times the reach multiplier. Boxes are filled with the
attached cable's color (dark when no cable); DAC/AOC and empty cages show none.

## Drawing

Drawing strategy is selected by device shape:

- **Rack faceplate** (height > 0): front and rear faces, same width. Each group is titled with form factor,
  native speed and count (`QSFP-DD 400G ×32`); each data port shows its index, speed (`400G` unsplit,
  `2x400G` breakout — never `1x…`) and reach. Ports are ≥ 54x46 units, text ≥ 9 units, drawn 1:1. Width follows content — the
  widest face (ports + PSUs) sets the box width, so small devices draw narrow.
- **Vertical PDU** (category `pdu`, height 0): a tall strip with input cord at the top, outlets
  stacked by bank, each bank labelled with breaker/phase and colored by phase (L1/L2/L3).

## UI

- Sidebar: tree **Vendor → Category → Device** with a text filter (name, vendor, model, id).
- **+ New** opens a template picker (switch, server, vertical PDU, horizontal PDU, patch panel, OCS,
  power shelf, storage, blank). Each template creates a device with realistic port roles
  (data + mgmt + console, PSUs, PDU banks).
- Delete works for project devices and built-in devices. Deleting a built-in hides it in this project
  (`hiddenBuiltins`); "Show hidden built-ins" restores them.
- Canvas: click a port to select it, Ctrl/Shift-click to add to the selection.
- Inspector: general fields, custom properties (editable on built-ins too; manage definitions inline), PSU / PDU input, port group editor (role, bank, phase), breakout profile
  editor (group default and selected-ports setting: mode, optic, cable).
- Export SVG of the drawing; export device JSON.
