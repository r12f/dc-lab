# Devices (L10)

Single-device definitions. One device = one JSON file (`schema: "dc-lab/device@1"`).

## Device model

| Field | Meaning |
|---|---|
| `id`, `name`, `vendor`, `model` | Identity. `id` is unique across built-in + project. `model` is shown as **Model / Vendor PN**. |
| `properties` | Values of project-wide custom properties (see [05-project-file.md](05-project-file.md#custom-properties)) |
| `category` | `switch`, `server`, `pdu`, `patch-panel` (Patch / Fiber Housing), `ocs`, `power-shelf`, `storage`, `tester`, `console-server`, `cdu`, `other`, `blanking-panel`, `stiffener`, `brush-panel`, `reserved` |
| `height` | `{ units, system: "RU" \| "OU" }`; `0` units = zero-U (vertical PDU, side-pod device) |
| `depthMm`, `weightKg` | Physical metrics |
| `power` | `{ typicalW, maxW, capacityW? }`. `capacityW` is set for power *suppliers* (PDU, power shelf). |
| `psus` | Optional `{ count, inlet, ratedW }` — hot-swap PSUs on the rear face |
| `pdu` | Optional PDU input: `{ phases, voltageV, inputCurrentA, inputPlug }` |
| `ports` | List of **port groups** |
| `breakoutProfiles` | Named per-port configurations |

### Category traits

Each category has traits used by the rest of the app (a fixed calm color — never red/amber, which mean
warnings —, whether it supplies power, whether it may
mount zero-U in a side pod). Suppliers' `typicalW/maxW` is their own loss; `capacityW` counts toward
rack supply capacity.

### Port groups

A port group is a run of identical ports: `label`, `role`, `formFactor`, `count`, `speedGbps` (native),
`lanes`, `face` (front/rear), `rows` (layout rows on the faceplate), `breakoutModes`
(e.g. `["2x400G", "4x200G", "8x100G"]`; native `1x<speed>G` is implicit), and for fiber-connector
ports `opticalEngine` (`cpo` | `npo`).
Fiber connector ports (LC, CS, SN, MPO, MMC) must set `cableGender`: the gender of the **cable connector the port
takes** (`male` = plug a male / pinned end in), not the port's own connector — the UI shows what you connect. The
device inspector warns until it is set. Only cable ends of that gender fit: Rack Designer offers and accepts only
those cables and flags others. Transceiver faces take female ends; a pigtail leg takes the opposite of its own
gender. Port labels show the taken gender ("MPO-12F"). Example: an MMC fiber housing takes male on the front, female on the rear.

### Form factors

The **form factor** of a port is fixed by the hardware. It comes from a registry
(`src/domain/ports/form-factors.ts`) with a `kind`:

| Kind | Examples | Meaning |
|---|---|---|
| `cage` | SFP28, SFP112, QSFP28, QSFP56, QSFP112, QSFP-DD, OSFP, OSFP-XD, ELSFP | Pluggable module cage |
| `fiber` | LC, CS, SN, MPO-12, MPO-16, MMC-16 | Fiber connector directly on the faceplate |
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

Co-packaged (CPO) and near-packaged (NPO) optics switches expose **fiber connectors** (MMC-16, MPO-16,
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
The effective breakout and optic/cable are drawn on every port. **Every port of every device** shows
its interface type and mode as one label, e.g. `OSFP 800G`, `OSFP 2x400G`, `RJ45 1G`, `LC`, `C13`,
`C19`: the form factor, plus the effective speed when the port is rated (`speedGbps > 0`).

Each data/service port also shows, along its bottom edge, one sub-box per **cable connector** (leg) on
the port face: the module's fiber connectors
(`2xDR4` module with `2x MPO-12` → two MPO-12 boxes, `2xFR4` → two LC boxes, pigtail → one per leg) or,
for CPO/NPO fiber ports, the port's own connector — always one box: an MMC-16 port carries `2xDR4` on its
16 fibers, split downstream with a Y-cable (MMC-16 → 2x MPO-8). Boxes are filled with the
attached cable's color (dark when no cable); DAC/AOC and empty cages show none.

## Drawing

Drawing strategy is selected by device shape:

- **Rack faceplate** (height > 0): front and rear faces, same width. Each group is titled with form factor,
  native speed and count (`QSFP-DD 400G ×32`); each data port shows its index, speed (`400G` unsplit,
  `2x400G` breakout — never `1x…`) and reach. Ports are ≥ 54x46 units, text ≥ 9 units, drawn 1:1. Width follows content — the
  widest face (ports + PSUs) sets the box width, so small devices draw narrow.
- **CDU** (category `cdu`): `cooling: { capacityKw, pumpW }` — heat it removes and pump draw (added to its
  power). Built-ins: In-Rack 7 kW (4U), In-Row Sidecar 110 kW (48RU, fills a CDU rack).
- **DC PDU** (`dc-pdu`): room-level PDU item, picked by PDU facilities in DC Layout (supply capacity = their
  default max power); hidden from the Rack Designer palette.
- **In-Row Chiller** (`chiller`): full-height device with cooling capacity / pump power; fills a chiller rack.
- **Default breakout profile** (`defaultProfileId`): every device has one. Built-in switches ship "Default (max
  speed, no module)": every cage at its native (maximum) speed with no module (empty cage; the connector is the
  cage form factor, so DAC / AEC / AOC fit in Rack Designer). Other built-ins (servers, testers) keep their DR
  module default. 100G QSFP28 has **PSM4** (4x25G parallel, MPO-12) and **DR1** (single lane, LC); there is no
  100G DR4. Old project settings load as DR -> DR1. Placements
  that pick no profile and the Devices canvas use it; "Make default" in the profile editor; the default cannot
  be deleted. Projects get a "Default" profile on load.
- **Profiles on built-in devices**: a built-in device stays read-only, but its breakout profiles are editable
  (add / edit / delete / make default). The edits are stored in the project (`builtinProfiles[deviceId]`,
  replacing the shipped list) and survive save / load; "Reset to built-in profiles" discards them.
- **Items tab**: the Devices inspector has **Item type** | **Items (n)** tabs. A device item can override the item
  type's **typical / max power and weight** (`specs`); empty fields inherit. Rack metrics and the BOM use the
  placed item's values. Each item in the list has a ✕ delete button, and an opened item has "✕ Delete item"
  at the bottom (both ask to confirm; also in Optics & Cables).
- **Variable height** (`resizable`): any device can be marked "Variable height" in the Devices inspector; its
  height is then set per placement in Rack Designer and `height` is the default size. Fillers (below) default to it.
- **PSU arrangement** (`psus.layout`): `split` (default, half on each rear edge) or `row` (one row side by side,
  e.g. power shelves).
- **Misc — size-adjustable fillers**: blanking panel, brush panel, stiffener and Empty (Reserved) are listed
  together under the **Misc** folder (sidebar and palette). Each is **one item whose height is set per
  placement** in Rack Designer (1…n units, in the rack's unit system — RU or OU), not one item per size. The
  item's height is its default size; weight scales linearly from it. BOM lines are named and split by size
  (`2RU Blanking Panel`). Built-ins: `blanking-panel`, `brush-panel`, `stiffener`, `reserved` (1RU default);
  the former fixed-size built-ins (`blanking-panel-2ru`, `reserved-4ru`, `stiffener-1ou`…) migrate to these
  with the old height.
- **Patch / Fiber Housing** (category `patch-panel`): fiber patch panels and housings; its own folder.
- **Blanking panel / stiffener** (categories `blanking-panel`, `stiffener` — passive "filler" hardware with
  no ports, PSUs or power): a single front panel at true scale (19" wide, height from RU/OU) with
  mounting ears; blanking panels dark, stiffeners steel grey with a rib. They occupy units in Rack
  Designer and count in the BOM and weight like any device.
- **Brush panel** (category `brush-panel`): filler hardware with a horizontal slot closed by brush
  bristles, so cables pass front-to-rear while airflow stays blocked. Drawn as a dark panel with the
  bristle slot; holds units, counts in BOM and weight, no power.
- **Empty (Reserved)** (category `reserved`): units **deliberately left empty** (future growth, airflow,
  cable slack). Unlike a blanking panel it is not hardware: drawn as a dashed outline on the empty-slot
  fill with "EMPTY (RESERVED)", it occupies units in Rack Designer (nothing else can be placed there) but
  has no weight, power or BOM line.
- **Vertical PDU** (category `pdu`, height 0): a tall strip with input cord at the top, outlets
  stacked by bank, each bank labelled with breaker/phase and colored by phase (L1/L2/L3).

## UI

- Sidebar: tree **Type (category) → Item type → Item** (see `09-item-variants.md`) with a text filter
  (name, vendor, model, id). Switches are sorted by data-port bandwidth (`count × speed` of `data` groups;
  mgmt/console/service/laser excluded), highest first, ties by name; other categories by name.
- **+ New** opens a template picker (switch, server, vertical PDU, horizontal PDU, patch panel, OCS,
  power shelf, storage, blanking panel, stiffener, blank). Each template creates a device with realistic port roles
  (data + mgmt + console, PSUs, PDU banks).
- Delete works for project devices only: built-in devices (and the generic item of a built-in type) cannot be
  deleted; ✕ is disabled with "Built-in items cannot be deleted". Same in Racks and Optics and Cables.
- Canvas: click a port to select it, Ctrl/Shift-click to add to the selection.
- Inspector: general fields, custom properties (editable on built-ins too; manage definitions inline), PSU / PDU input, port group editor (role, bank, phase), breakout profile
  editor (group default and selected-ports setting: mode, optic, cable).
- Export SVG of the drawing; export device JSON.

**Port glyph (Devices canvas)**: line 1 the port number; line 2 form factor + breakout ("OSFP 8x100G"); then one
cell per cable connector side by side, each connector type over the leg's reach — a 2xDR4 module shows
"MPO-12 | MPO-12" over "DR4 | DR4". An empty cage shows one cell with the cage form factor (OSFP, QSFP-DD…).

**Breakout profiles set cage + connector only**: per port / group a profile picks the speed / breakout, the reach
and module (the cage content) — no cable, and no DAC / AEC / AOC reach. Reach "none — no module" leaves the cage
empty: its cable connector is then the cage form factor itself (e.g. OSFP), so the Rack Designer cabling view
offers exactly the DAC / AEC / AOC that fit that cage and speed. Profiles no longer store `cableId` (dropped on
load); a placement can still set one in Rack Designer.

**Port settings = Speed → Module Type → Module**:
- **Module Type**: None, or a reach class the cage takes at <= the physical port speed (2xDR4, 2xLR4, DR4…).
  Variants fold into their type ("2xDR4+" and "2xDR4 LPO" are 2xDR4; "DR4-2" is DR4) and the 4-lane
  parallel SMF family is one type, named **PSM4** on <= 100G ports and **DR4** above (a 400G QSFP-DD port's
  DR4 list includes the 100G PSM4 module). The **Connector Type** follows from it and is shown;
  None leaves the cage empty and the connector is the cage form factor (OSFP, QSFP-DD…).
- **Module** (shown when a type is set): every module of that type the cage physically takes at <= port speed —
  QSFP-DD takes QSFP56 / QSFP28 modules, QSFP28 does not take QSFP-DD. "auto" picks the module at the breakout's
  speed (else the fastest of the type); a pinned module is kept while it is of the chosen type.
- Rack Designer port settings also offer DAC / AEC / AOC and the Cable; breakout profiles do not.

**Heat sink (IHS / RHS)**: pluggable cages carry `heatSink` — **IHS** (module with an integrated, finned heat
sink) or **RHS** (riding heat sink / cold plate on the host); unset = RHS. A cage takes only modules of the same
heat sink; IHS and RHS never mix. Set per port group in the port group editor (cages only) and shown in the
group summary and port tooltip. Built-ins: 64x800G OSFP switch and both OSFP testers are IHS; the liquid-cooled
64x1.6T OSFP LC switch is RHS; all QSFP / SFP cages are RHS.

**Port order and names**: `fill` (`column-major` default, or `row-major`) and `bottomUp` (port 1 in the bottom
row) set how ports fill the grid. `subPorts` gives two-level names — every `subPorts` ports share a number and take
letters (4: 1A 1B 1C 1D 2A…) — counted from `firstNumber` (default 1), so a column of cassettes can continue the
numbering of the previous one. Names are for display (faceplate, cabling view, tooltips); port refs stay
`group/index`. Example: the built-in 2RU 96x MPO-8 housing = 4 groups (columns) of 6 cassettes x 4 connectors, row-major,
bottom up, subPorts 4, firstNumber 1 / 7 / 13 / 19.

**Empty grid cells (`holes`)**: a port group may list grid cells (column-major indices over its `rows`) left
empty; ports fill the remaining cells in order. Used for modules whose faceplate is not a full grid — e.g. a
fiber-housing module with one 2x MMC slot top-left and a 3x3 block beside it (6 rows, holes 2-5: ports 1-2 the
single slot, 3-20 the block). Edited as "Empty cells" in the port group editor; Devices canvas and Rack
Designer cabling view both honour it.
