# Racks

Rack templates. One template = one JSON file (`schema: "dc-lab/rack@1"`).

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind`: `network`, `server`, `mgx`, `orv3`, `orw`, `custom` |
| `units`, `unitSystem` | Usable mounting units and RU/OU |
| `widthMm`, `depthMm`, `heightMm` | External dimensions of the rack body |
| `footprintTiles` | `{ wide, deep }` — floor tiles the rack occupies in a row (including side elements). `wide` may be fractional in 0.5 steps (ORv3 = 1.5 tiles) |
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

`footprintTiles.wide` of built-in network racks covers body + side elements (600 + 2×400 mm → 3 tiles).

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
