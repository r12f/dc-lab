# Racks (L11)

Rack templates. One template = one JSON file (`schema: "dc-lab/rack@1"`).

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind`: `network`, `server`, `mgx`, `orv3`, `orw`, `custom` |
| `units`, `unitSystem` | Usable mounting units and RU/OU |
| `widthMm`, `depthMm`, `heightMm` | External dimensions of the rack body |
| `footprintTiles` | `{ wide, deep }` — floor tiles the rack occupies in a row (including side elements) |
| `emptyWeightKg`, `maxLoadKg` | Static weight and rated payload |
| `maxPowerW` | Rated rack power |
| `sideElements` | Boxes attached to the left/right of the rack body (see below) |
| `notes` | Free text |

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
- Inspector: all fields; side elements section with "+ Left" / "+ Right" (pick kind), per-element
  editor, move toward/away from the rack, remove.
- Export SVG.
