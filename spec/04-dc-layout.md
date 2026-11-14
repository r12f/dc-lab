# DC Layout (L12)

A layout (`schema: "dc-lab/layout@1"`) is a room floor plan, top view. x grows east (right), y grows
south (down), units are millimetres.

## Model

- `room`: `{ widthMm, depthMm }` — the whole hall.
- `whitespace`: rectangle `x, y, widthMm, depthMm` inside the room — the **rack area**. Rows and aisles
  are laid out only inside it.
- `facilities[]`: support equipment around the rack area — `kind` (`pdu` | `cooling` | `other`), `name`,
  rectangle `x, y, widthMm, depthMm`, optional `capacityKw`. Placed freely in the room (typically along
  the walls, outside the rack area).
- `rows[]`: `name`, `tileCount`, `tileWidthMm` (pitch along the row), `tileDepthMm` (across the row),
  `powerBudgetKw`, `frontFacing` (`east`/`west` — the side facing the cold aisle). Rows run
  **vertically** (north–south). They have no stored position.
- `aisles[]`: `kind` (hot/cold), `widthMm`. No stored position; an aisle spans the rack area's depth.
- `sequence`: ids of rows and aisles from west to east.
- `trays[]`: overhead cable trays — `kind` (data/power), `aisleId`, `widthMm`. A tray **floats above an
  aisle**: centred on it, running its full length, drawn on top of everything.
- `assignments[]`: `rowId`, `startTile` (0-based, from the north end), `designId`, `label`.

## Arrangement (derived, never stored)

- Rows and aisles are packed edge to edge from the west edge of the rack area in `sequence` order; a
  row's band is `tileDepthMm` wide, an aisle's `widthMm`. All start at the rack area's north edge.
  A row is `tileCount × tileWidthMm` long; an aisle is as long as the rack area is deep.
- New rows and aisles are appended at the east end of the sequence, so adding row, aisle, row… builds a
  hot/cold aisle sequence. A new tray goes over the selected aisle, else the first aisle.
- Warnings: sequence wider than the rack area; a row longer than the rack area; a facility overlapping
  the rack area.

## Rules

- An assignment occupies `template.footprintTiles.wide` tiles starting at `startTile`. Widths can be fractional
  (ORv3 = 1.5 tiles), so `startTile` can be fractional too: assigning on a tile partly filled by a previous rack
  starts the new rack where that one ends (two ORv3 racks fill 3 tiles exactly). Racks may not overlap.
  "Tiles used" sums the widths (e.g. `4.5/12 tiles`).
- It must stay inside the row and must not overlap another assignment.
- Row power = sum of assigned designs' typical power; warn when above `powerBudgetKw`.

## Derived data

- Per rack: label and typical power drawn on the canvas; full summary in a hover tooltip.
- Per row: tiles used, power vs. budget — drawn on the canvas above each row and in the inspector.
- DC totals: racks, typical/max power, weight; DC BOM = sum of rack BOMs.

## UI

- Sidebar: layouts with a text filter (name, row names, rack labels); New, Duplicate, Delete.
- Canvas:
  - room, rack area (dashed outline), facilities (PDU amber, cooling cyan, other grey), aisles (blue
    cold / red hot), vertical rows of tiles with a front-side marker, assigned racks, trays on top
    (semi-transparent, so the aisle stays visible under them).
  - Title bar (next to Export SVG): **+ Row**, **+ Aisle**, **+ Tray**, **+ PDU**, **+ Cooling**,
    **Duplicate** (Ctrl+D) and **Delete** (Del) for the selection.
  - **Add after the selection**: + Row / + Aisle insert right after the selected row or aisle (the
    easternmost when several; a selected tile/rack counts as its row, a tray as its aisle), else at the
    east end. + Tray goes over the selected aisle, else the next aisle east of the selection, else the first
    aisle without a tray. + PDU / + Cooling go right of the selected facility. The new element becomes
    the selection, so repeated clicks build row / aisle / row… in place.
  - **Selection**: click a row header, aisle, tray or facility; Ctrl/Shift-click adds or removes elements
    of the same kind. The inspector also offers group selections (all rows, cold aisles, hot aisles, all
    trays, facilities). With several selected, the inspector edits them together: a changed field is
    applied to all; fields that differ show "mixed".
  - **Hit testing**: trays are overhead, drawn over their aisle; only a tray's outline and label take clicks,
    so clicking inside an aisle selects the aisle even where a tray runs over it.
  - **Duplicate**: row copies (with their racks, relabelled) and aisle copies are appended at the **east end**
    of the sequence, in the originals' west-to-east order, so duplicating a row + aisle pattern repeats it;
    a tray copy goes over the next aisle east that has no tray of that kind; a facility copy is
    offset 200 mm.
  - **Drag** a row (by its header) or an aisle sideways to **reorder** it in the sequence; the plan
    re-packs live while dragging. **Drag** a tray onto another aisle to move it there. **Drag** a
    facility to move it freely (snapped to 100 mm, kept inside the room). A click without movement
    just selects.
  - Each rack tile shows the design **abbreviation** (large), the rack label and its typical power.
  - Each row header shows `name`, `power / budget` (red when over budget) and `used/total tiles`.
  - **Hover** a rack: tooltip with label, design, rack template, tiles, units used, devices, typical and
    max power, weight, warnings.
  - Click a tile to select it, click a rack to select the assignment.
- Inspector: room and rack-area fields, layout warnings, group selections, selected element(s) editor,
  tile assignment, DC BOM.
- Export SVG (tooltip and drag previews are not exported).
