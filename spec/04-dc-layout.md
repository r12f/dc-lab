# DC Layout (L12)

A layout (`schema: "dc-lab/layout@1"`) is a room floor plan.

## Model

- `room`: `{ widthMm, depthMm }`
- `rows[]`: `name`, origin `x,y` (mm), `tileCount`, `tileWidthMm`, `tileDepthMm`, `powerBudgetKw`,
  `frontFacing` (`north`/`south` — which side is the cold aisle).
- `aisles[]`: `kind` (hot/cold), rectangle `x,y,widthMm,depthMm`.
- `trays[]`: `kind` (data/power), rectangle `x,y,widthMm,depthMm`.
- `assignments[]`: `rowId`, `startTile` (0-based), `designId`, `label`.

## Rules

- An assignment occupies `template.footprintTiles.wide` consecutive tiles starting at `startTile`.
- It must stay inside the row and must not overlap another assignment.
- Row power = sum of assigned designs' typical power; warn when above `powerBudgetKw`.

## Derived data

- Per rack: name, label, typical power drawn on the canvas.
- Per row: tiles used, power vs. budget.
- DC totals: racks, typical/max power, weight; DC BOM = sum of rack BOMs.

## UI

- Sidebar: layouts with a text filter (name, row names, rack labels); New, Duplicate, Delete.
- Canvas: room, aisles (blue cold / red hot), trays, rows of tiles, assigned racks; click a tile to
  select it, click a rack to select the assignment.
- Inspector: layout fields, add row/aisle/tray, selected element editor, tile assignment, DC BOM.
- Export SVG.
