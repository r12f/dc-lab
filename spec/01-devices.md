# Devices (L10)

Single-device definitions. One device = one JSON file (`schema: "dc-lab/device@1"`).

## Device model

| Field | Meaning |
|---|---|
| `id`, `name`, `vendor`, `model` | Identity. `id` is unique across built-in + project. |
| `category` | `switch`, `server`, `pdu`, `patch-panel`, `ocs`, `power-shelf`, `storage`, `other` |
| `height` | `{ units, system: "RU" \| "OU" }`; `0` units = zero-U (side pod / vertical PDU) |
| `depthMm`, `weightKg` | Physical metrics |
| `power` | `{ typicalW, maxW, capacityW? }`. `capacityW` is set for power *suppliers* (PDU, power shelf). |
| `ports` | List of **port groups** |
| `breakoutProfiles` | Named per-port breakout layouts |

### Category traits

Each category has traits used by the rest of the app (color, whether it supplies power, whether it may
mount zero-U in a side pod). Suppliers' `typicalW/maxW` is their own loss; `capacityW` counts toward
rack supply capacity.

### Port groups

A port group is a run of identical cages: `label`, `connector` (OSFP, QSFP-DD, …), `count`,
`speedGbps` (native), `lanes`, `face` (front/rear), `rows` (layout rows on the faceplate), and
`breakoutModes` (e.g. `["2x400G", "4x200G", "8x100G"]`). Native mode `1x<speed>G` is always allowed.

Ports are addressed as `<groupId>/<index>` (1-based), e.g. `osfp/17`.

### Breakout profiles

A profile has a `defaultMode` per group (or none = native) and `overrides` keyed by port ref.
Example: port 1 = `8x100G`, port 2 = `4x200G`, everything else native.
A mode is valid if it is in the group's allowed list and `fanout x speed <= native speed`.

## UI

- Sidebar: devices grouped by category; built-in and project sections; New, Duplicate, Delete.
- Canvas: faceplate drawing (front and rear faces), ports colored by effective breakout mode of the
  selected profile; clicking a port selects it.
- Inspector: general fields, port group editor, breakout profile editor (profile list, group default,
  selected-port override, "apply to group").
- Export SVG of the faceplate.
