# Devices (L10)

Single-device definitions. One device = one JSON file (`schema: "dc-lab/device@1"`).

## Device model

| Field | Meaning |
|---|---|
| `id`, `name`, `vendor`, `model` | Identity. `id` is unique across built-in + project. |
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

A port group is a run of identical cages: `label`, `role`, `connector` (OSFP, QSFP-DD, RJ45, C13…),
`count`, `speedGbps` (native), `lanes`, `face` (front/rear), `rows` (layout rows on the faceplate),
`breakoutModes` (e.g. `["2x400G", "4x200G", "8x100G"]`; native `1x<speed>G` is implicit).

`role` is one of:

| Role | Use |
|---|---|
| `data` | Front-panel / NIC data ports |
| `mgmt` | Out-of-band management Ethernet (RJ45) |
| `console` | Serial console (RJ45) |
| `service` | Service/in-band ports, e.g. 2x 10G SFP+ on high-radix switches |
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
PortSetting = { mode?: "4x200G", opticId?: "osfp-800g-2xdr4", cableId?: "dac-800g" }
profile = { id, name, groupDefaults: { [groupId]: PortSetting }, overrides: { [portRef]: PortSetting } }
```

Each field resolves independently: instance override (Rack Designer) > profile port override >
profile group default > native mode / no optic / no cable. Optics must match the port connector.
The effective breakout and optic/cable are drawn on every port.

## Drawing

Drawing strategy is selected by device shape:

- **Rack faceplate** (height > 0): front and rear faces, same width. Width follows content — the
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
- Inspector: general fields, PSU / PDU input, port group editor (role, bank, phase), breakout profile
  editor (group default and selected-ports setting: mode, optic, cable).
- Export SVG of the drawing; export device JSON.
