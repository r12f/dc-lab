# Racks

Rack templates. One template = one JSON file (`schema: "dc-lab/rack@1"`).

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind`: `network`, `server`, `mgx`, `orv3`, `orw`, `custom` |
| `units`, `unitSystem` | Usable mounting units and RU/OU |
| `widthMm`, `depthMm`, `heightMm` | External dimensions of the rack body |
| `footprintTiles` | `{ wide, deep }` — floor tiles the rack occupies in a row (including side elements). `wide` may be fractional in 0.5 steps (ORv3 = 1 tile) |
| `emptyWeightKg`, `maxLoadKg` | Static weight and rated payload |
| `maxPowerW` | Rated rack power |
| `sideElements` | Boxes attached to the left/right of the rack body (see below) |
| `notes` | Free text |
| `properties` | Values of project-wide custom properties (see [05-project-file.md](05-project-file.md#custom-properties)) |

## Side elements

A rack can have any number of boxes on either side. Each box is one **side element**:

| Field | Meaning |
|---|---|
| `id`, `name` | Identity, e.g. `"Sidepod L"` |
| `kind` | `sidepod`, `pdu-bay`, `cable-manager`, `other` |
| `side` | `left` or `right` |
| `widthMm`, `depthMm` | Physical size; width is drawn to scale next to the rack |
| `slots` | Vertical mounting positions inside the box (0 = nothing mounts) |
| `weightKg` | Empty weight, added to the rack weight |

Elements on one side are ordered from the rack body outward (first = adjacent to the rack).

Defaults by rack kind (built-in templates follow these):

| Rack kind | Side elements |
|---|---|
| `network` | each side: PDU bay (100 mm, 1 slot, next to the body) + sidepod (300 mm, 1 slot, outside) |
| `server`, `mgx`, `orv3`, `orw` | none |
| `power`, `cdu` | none |

**Power and CDU racks** (`kind: power` / `cdu`) are infrastructure racks: they serve neighbouring IT racks in
DC Layout instead of drawing an IT load. Each has its own size, footprint and frame weight. A sidecar whose
enclosure *is* the device (in-row CDU) sets frame weight, load limit and power rating to **0** — "not rated";
the full-height device carries weight and power. Built-ins: **Power Rack 48RU** (`power-rack-48ru`, MGX frame;
holds power shelves + BBU shelves) and **CDU Sidecar Rack** (`cdu-rack-sidecar`, 48RU, 1 tile; holds one
full-height CDU).
| `mgx` variant **MGX Rack 48RU (PDU+SidePods)** | same side elements as `network` (PDU bay + sidepod each side, 3 tiles wide); listed under MGX |

Network racks are 600 mm wide. **PDU bays sit inside the rack enclosure** (between the rails and the side
panel), so they add no width: the footprint is the body plus the side elements outside it (sidepods, cable
managers, other). Built-in network racks: 600 + 2×300 mm sidepods = 1200 mm (fits the 3-tile pitch); the
footprint view draws PDU bays over the body edges. In-rack cable length counts no distance through a PDU bay
for a sidepod outside it. The former built-in `network-48ru-800` is now `network-48ru-600`; projects are migrated.

Kind traits (registry):

| Kind | Drawn as | Accepts |
|---|---|---|
| `sidepod` | dashed outline | any device |
| `pdu-bay` | solid outline | PDUs |
| `cable-manager` | solid, hatched | nothing |
| `other` | solid outline | zero-U capable devices |

Empty slots are drawn as dashed boxes inside the element; slots exist only where the user defines them.

## UI

- Sidebar: templates grouped by kind, with a text filter (name, kind, size, side element names);
  New, Duplicate, Delete.
- Canvas: front elevation with side elements drawn to scale (units numbered bottom-up), and a
  top-down footprint showing the rack body and side elements over floor tiles.
- Inspector: all fields; custom properties (editable on built-ins too; manage definitions inline); side elements section with "+ Left" / "+ Right" (pick kind), per-element
  editor, move toward/away from the rack, remove.
- Export SVG.
