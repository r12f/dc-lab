# DC Layout (L12)

A layout (`schema: "dc-lab/layout@1"`) is a room floor plan, top view. x grows east (right), y grows
south (down), units are millimetres.

## Model

- `room`: `{ widthMm, depthMm }`
- `rows[]`: `name`, origin `x,y` (top-left, mm), `tileCount`, `tileWidthMm` (pitch along the row),
  `tileDepthMm` (across the row), `powerBudgetKw`, `frontFacing` (`east`/`west` — the side facing the
  cold aisle). Rows run **vertically** (north–south): tile `i` spans
  `y + i * tileWidthMm … y + (i + 1) * tileWidthMm`, and the row is `tileDepthMm` wide.
- `aisles[]`: `kind` (hot/cold), rectangle `x,y,widthMm,depthMm`.
- `trays[]`: `kind` (data/power), rectangle `x,y,widthMm,depthMm`.
- `assignments[]`: `rowId`, `startTile` (0-based, from the north end), `designId`, `label`.

New rows, aisles and trays are placed east of the right-most element, so adding row, aisle, row…
builds a hot/cold aisle sequence across the room.

## Rules

- An assignment occupies `template.footprintTiles.wide` consecutive tiles starting at `startTile`.
- It must stay inside the row and must not overlap another assignment.
- Row power = sum of assigned designs' typical power; warn when above `powerBudgetKw`.

## Derived data

- Per rack: label and typical power drawn on the canvas; full summary in a hover tooltip.
- Per row: tiles used, power vs. budget — drawn on the canvas above each row and in the inspector.
- DC totals: racks, typical/max power, weight; DC BOM = sum of rack BOMs.

## UI

- Sidebar: layouts with a text filter (name, row names, rack labels); New, Duplicate, Delete.
- Canvas:
  - room, aisles (blue cold / red hot), trays, vertical rows of tiles with a front-side marker,
    assigned racks.
  - **Drag** a row (by its header), an aisle or a tray to move it; positions snap to 100 mm and stay
    inside the room. Dragging selects the element; a click without movement just selects.
  - Each row header shows `name` and `power / budget` (red when over budget).
  - **Hover** a rack: tooltip with label, design, rack template, tiles, units used, devices, typical and
    max power, weight, warnings.
  - Click a tile to select it, click a rack to select the assignment.
- Inspector: layout fields, add row/aisle/tray, selected element editor, tile assignment, DC BOM.
- Export SVG (tooltip and drag previews are not exported).
