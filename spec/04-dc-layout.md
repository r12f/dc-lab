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
- `feeds[]`: `{ id, facilityId, rowId, kw }` — PDU-to-row power feeds (older layouts load with none).
- `rows[]`: `name`, `tileCount`, `tileWidthMm` (pitch along the row), `tileDepthMm` (across the row),
  `powerBudgetKw`, `frontFacing` (`east`/`west` — the side facing the cold aisle). Rows run
  **vertically** (north–south). They have no stored position.
- `aisles[]`: `kind` (hot/cold), `widthMm`. No stored position; an aisle spans the rack area's depth.
- `sequence`: ids of rows and aisles from west to east.
- `trays[]`: overhead cable trays — `kind` (data/power), `aisleId`, `widthMm`. A tray **floats above an
  aisle**: centred on it, running its full length, drawn on top of everything.
- `assignments[]`: `rowId`, `startTile` (0-based, from the north end), `designId`, `label`; power / CDU racks
  optionally `serves[]` — ids of the IT racks they serve.

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
  - **View rotation**: ⟲ / ⟳ 90° in the title bar turn the drawing by 90° (saved with the layout), e.g.
    to show rows running east–west. Only the view turns — rows, aisles, sequence, doors and walls keep their
    north-up data, and dragging works in the rotated view. A north arrow shows where north is. Labels stay
    readable: row headers and rack tiles stay upright, aisle / tray / door labels keep following their
    element but never read upside down. SVG export uses the current view.
  - **Doors**: **+ Door** adds the entry (1.2 m, centred on the south wall), or with a door selected a
    door next to it on the same wall. Drawn as an architectural door: gap in the wall, open leaf, swing arc,
    an inward arrow and the name outside the wall (the entry is bold and reads ENTRY; labels on east/west
    walls run along the wall). Drag a door to slide it along the walls (it snaps to the nearest wall); the
    inspector edits name, kind, wall, offset and width. Older layouts load with no doors.
  - **Power feeds (PDU → row)**: select a PDU facility to set how many kW it feeds each row (0 = not
    connected; one feed per PDU-row pair, a row may take feeds from several PDUs). Feeds are drawn as
    dashed lines from the PDU to the row header, labelled with kW (labels of several feeds into one row
    stack above its header); selecting the PDU or the row highlights its feeds. A selected row lists its
    feeds and fed kW vs draw. Warnings: a PDU whose feeds exceed its capacity, a fed row drawing more than
    it is fed. The DC totals table has a "PDU feed" column. Deleting a PDU or row removes its feeds.
  - Each rack tile shows the design **abbreviation** (large), the rack label and its typical power.
  - Each row header shows `name`, `power / budget` (red when over budget) and `used/total tiles`.
  - **Hover** a rack: tooltip with label, design, rack template, tiles, units used, devices, typical and
    max power, weight, warnings.
  - Click a tile to select it, click a rack to select the assignment.
- Inspector: room and rack-area fields, layout warnings, group selections, selected element(s) editor,
  tile assignment, DC BOM.
- Export SVG (tooltip and drag previews are not exported).
