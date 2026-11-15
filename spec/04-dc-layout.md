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
- `viewRotation`: `0 | 90 | 180 | 270` — display rotation, clockwise (optional, default 0).
- `doors[]`: `{ id, name, wall (north|south|east|west), offsetMm, widthMm, kind (entry|exit) }` — doors in the
  room walls; offset from the west end (north/south walls) or north end (east/west walls).
- Facilities also carry `deviceId?` (DC PDU / cooling item), `capacityKw?` (max power; empty = the item's),
  `rowIds?` (PDU: rows it feeds) and `aisleIds?` (cooling: hot aisles it serves). Old `feeds[]` load as the
  PDU's `rowIds` (their kW is dropped: loads are computed).
- `rows[]`: `name`, `tileCount`, `tileWidthMm` (pitch along the row), `tileDepthMm` (across the row),
  `powerBudgetKw`, `frontFacing` (`east`/`west` — the side facing the cold aisle). Rows run
  **vertically** (north–south). They have no stored position.
- `aisles[]`: `kind` (hot/cold), `widthMm`, `cross?`. No stored position. A lengthwise aisle spans its row
  block's depth. A **cross aisle** (`cross: true`) runs east–west across the whole rack area between two **row
  blocks** (rows of rows); its `widthMm` is north–south.
- `sequence`: ids of rows and aisles from west to east; a cross aisle in it ends one row block and starts the next
  (south of it).
- `trays[]`: overhead cable trays — `kind` (data/power), `overId`, `widthMm`, `offsetMm?`. A tray **floats over a
  band** — an aisle, a cross aisle, or a **row (over the rack tops)** — running its full length, centred on it and
  shifted `offsetMm` across it (+ = east / south); drawn on top of everything. Old `aisleId` loads as `overId`.
- `assignments[]`: `rowId`, `startTile` (0-based, from the north end), `designId`, `label`; power / CDU racks
  optionally `serves[]` — ids of the IT racks they serve.

## Arrangement (derived, never stored)

- Cross aisles split the sequence into **row blocks**, stacked from the rack area's north edge southwards. Inside
  a block, rows and aisles are packed edge to edge from the west edge in `sequence` order; a row's band is
  `tileDepthMm` wide, an aisle's `widthMm`. A row is `tileCount × tileWidthMm` long; a block is as deep as its
  longest row (the last block reaches down to the rack area's south edge, or its longest row) and its aisles span
  that depth. A cross aisle spans the rack area's width; the next block starts below it plus room for its row
  headers (1040 mm).
- A cross aisle is never a row's rear (hot) aisle for cooling loads; the hot-aisle lists leave cross aisles out.
- New rows and aisles are appended at the east end of the sequence, so adding row, aisle, row… builds a
  hot/cold aisle sequence. A new tray goes over the selected aisle, else the first aisle.
- Warnings: a row block wider than the rack area; a row longer than the rack area (one block) or blocks and cross
  aisles deeper than it; a facility overlapping the rack area; a tray over nothing.

## Rules

- An assignment occupies its template's computed footprint width in tiles (see Racks) starting at `startTile`. Widths can be fractional
  (e.g. a 1.5-tile template), so `startTile` can be fractional too: assigning on a tile partly filled by a previous rack
  starts the new rack where that one ends (two 1.5-tile racks fill 3 tiles exactly). Racks may not overlap.
  "Tiles used" sums the widths (e.g. `4.5/12 tiles`).
- It must stay inside the row and must not overlap another assignment.
- Row power = sum of assigned designs' typical power; warn when above `powerBudgetKw`.
- **Power / CDU racks** (designs on a `power` or `cdu` rack template) take tiles like any rack. Each serves IT
  racks: by default the **adjacent IT racks in its row** — walking out both ways over touching racks, past
  infrastructure racks of the other kind, stopping at a gap or at another rack of the same kind; or an explicit
  `serves` list picked in the inspector. Power/CDU racks that serve a common IT rack are pooled into one group.
  **Check per group**: supply (power shelves' capacity) and cooling (CDUs' capacity) must be ≥ the summed
  **max** power of the IT racks served (heat removed = power drawn). Under-sized groups and sidecars that serve
  nothing are warnings.
- Canvas: power racks amber, CDU racks cyan (labelled POWER / CDU); selecting one marks the IT racks it serves
  with a dashed ring. Inspector: "Serves" checklist + group capacity vs IT max; DC totals list every group.

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
  - Title bar (next to Export SVG): **+ Row**, **+ Aisle**, **+ Cross aisle**, **+ Tray**, **+ PDU**, **+ Cooling**,
    **Duplicate** (Ctrl+D) and **Delete** (Del) for the selection.
  - **Add after the selection**: + Row / + Aisle insert right after the selected row or aisle (the
    easternmost when several; a selected tile/rack counts as its row, a tray as its aisle), else at the
    east end. **+ Cross aisle** inserts there too: rows and aisles after it form the next row block. + Tray goes
    over the selected row (rack tops) / aisle / cross aisle (a selected tile or rack counts as its row), the next
    aisle east of a selected tray, else the first aisle without a tray. + PDU / + Cooling go right of the selected facility. The new element becomes
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
  - **Drag** a row (by its header) or an aisle sideways to **reorder** it in the sequence, or down / up into
    another row block; the plan re-packs live while dragging (cross aisles are not dragged). **Drag** a tray onto
    another row, aisle or cross aisle to move it there (the inspector also sets its offset). **Drag** a
    facility to move it freely (snapped to 100 mm, kept inside the room). A click without movement
    just selects.
  - **View rotation**: ⟲ / ⟳ 90° in the title bar turn the drawing by 90° (saved with the layout), e.g.
    to show rows running east–west. Only the view turns — rows, aisles, sequence, doors and walls keep their
    north-up data, and dragging works in the rotated view. A north arrow shows where north is. Labels stay
    readable: row headers and rack tiles stay upright, aisle / tray / door labels keep following their
    element but never read upside down. SVG export uses the current view.
  - **Doors**: **+ Door** adds the entry (1.2 m, centred on the south wall), or with a door selected a
    door next to it on the same wall. Drawn as an architectural door: gap in the wall, open leaf, swing arc,
    an inward arrow and the name outside the wall (the entry is bold and reads ENTRY; labels on east/west
    walls run along the wall). Drag a door to slide it along the walls (it snaps to the nearest wall); the
    inspector edits name, kind, how it opens (swing in / swing out / slide left / slide right — left/right as
    seen from inside facing the door), wall, offset and width. Older layouts load with no doors.
  - **PDU and cooling capacity (computed loads)**: a PDU sets its **max power** (or takes it from its
    **DC PDU** item) and ticks the **rows it feeds**; a cooling facility sets its max and ticks the **hot
    aisles it serves**. No kW is entered per link:
    - row demand = max power of its racks, power racks excluded (they pass power on), chillers included;
      a row fed by n PDUs takes 1/n of its demand from each;
    - hot aisle heat = demand of the rows whose rear (exhaust) faces it, minus the cooling capacity of the
      **in-row chiller** racks in those rows; an aisle served by n units puts 1/n on each;
    - a PDU / cooling unit whose summed share exceeds its max power is a warning.
    Links are drawn as dashed lines (PDU → row header, cooling → hot aisle) labelled with the computed kW;
    a selected row / hot aisle shows its demand / heat and who serves it. Deleting rows / aisles drops links.
  - **In-row chiller racks** (rack kind `chiller`, full-height In-Row Chiller device): draw air from the hot
    aisle and blow it cooled into the cold aisle; drawn teal "CHILLER" in the row.
  - Each rack tile shows the design **abbreviation** (large), the rack label and its typical power.
  - Each row header shows `name`, `power / budget` (red when over budget) and `used/total tiles`.
  - **Hover** a rack: tooltip with label, design, rack template, tiles, units used, devices, typical and
    max power, weight, warnings.
  - Click a tile to select it, click a rack to select it. **Ctrl-click** adds / removes tiles,
    **Shift-click** adds the run from the last selected tile in that row. With several tiles selected the
    inspector assigns one design to all of them in row / tile order, each rack starting where its tile is free;
    tiles already taken (including by a wide rack just placed) or too short are skipped and listed.
  - **Several racks**: Ctrl- or Shift-click racks to add / remove them (any rows). **Drag** a selected rack and
    the whole selection moves with it by whole rows (in row order, across row blocks) and tiles; the inspector
    also has ↑ / ↓ tile, ← / → row and a rows / tiles move. A move is **all or none**: when any rack would leave its
    row or overlap a rack that stays, nothing moves and the reason is shown (red on the canvas while dragging).
    Labels still in the automatic form (`Row1-03`) follow the new row / tile; hand-set labels stay. The inspector
    can also **change the design** of the selected racks in place (racks it does not fit are skipped and listed)
    and **remove** them (also Delete).
  - Drawing scale is fixed (100 % = 0.1 px/mm); when the layout is opened, rotated or the room size changes,
    the canvas zoom fits the room width to the pane (≤ 100 %), so the zoom level always matches the drawing.
- Inspector: room and rack-area fields, layout warnings, group selections, selected element(s) editor,
  tile assignment, DC BOM.
- Export SVG (tooltip and drag previews are not exported).
