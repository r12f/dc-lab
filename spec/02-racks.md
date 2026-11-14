# Racks (L11)

Rack templates. One template = one JSON file (`schema: "dc-lab/rack@1"`).

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind`: `network`, `server`, `mgx`, `orv3`, `orw`, `custom` |
| `units`, `unitSystem` | Usable mounting units and RU/OU |
| `widthMm`, `depthMm`, `heightMm` | External dimensions |
| `footprintTiles` | `{ wide, deep }` — floor tiles the rack occupies in a row |
| `emptyWeightKg`, `maxLoadKg` | Static weight and rated payload |
| `maxPowerW` | Rated rack power |
| `sidePods` | `{ left, right }` zero-U slot counts (vertical PDUs, cable managers) |
| `notes` | Free text |

## UI

- Sidebar: templates grouped by kind; built-in / project; New, Duplicate, Delete.
- Canvas: front elevation (units numbered bottom-up, side pods) and a top-down footprint with tiles.
- Inspector: all fields.
- Export SVG.
