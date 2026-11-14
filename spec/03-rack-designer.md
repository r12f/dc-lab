# Rack Designer (L11)

A **rack design** (`schema: "dc-lab/rack-design@1"`) is a rack template populated with devices.

## Model

- `templateId` — rack template.
- `placements[]` — a device instance:
  - `deviceId`, `label` (instance id, e.g. `T0-1`)
  - `mount`: `{ kind: "rack", position, face }` (bottom unit, 1-based) or `{ kind: "side", elementId, slot }`
    (slot in a rack side element, 1 = top)
  - `units` — size-adjustable fillers only (Misc: blanking / brush panel, stiffener, Empty): height in the
    rack's units; set in the Device tab ("Height"), rejected when it would overlap or leave the rack
  - `breakoutProfileId` — one of the device's profiles (optional); supplies default mode/optic/cable per port
  - `portSettings[portRef]` / `groupSettings[groupId]` — instance `{ mode, opticId, cableId }` overriding the profile
- `cables[]` — in-rack cable runs:
  - `from[]` — A-end connectors, up to `ends.a.count`; `to[]` — B-end connectors, up to `ends.b.count`
    (one each for a patch cord; 1 + 4 for an MPO → 4x LC breakout; 4 + 4 for a 4x4 shuffle; 20 + 20 for
    a 160F MPO-8 trunk)
  - endpoint = `placementId` + `portRef` (empty = any port) + `connector` (1-based **leg** of the port:
    a `2xDR4` module has legs 1 and 2, each an MPO-12). Runs connect **connector to connector**, not
    port to port: one physical port may terminate several runs, one per leg.
  - `route` — `left` | `right`: which side cable channel the run uses
  - `mediaId`, `quantity`
  - `lengthM` — manual length; omitted = **auto** (estimated, see below)

## Rules

- A rack-mounted device occupies `[position, position + units - 1]`; it must fit within the template and
  must not overlap another device on the same face (full-depth devices block both faces:
  a device is full-depth when `depthMm > template.depthMm / 2`).
- Zero-U devices (vertical PDUs, 0U patch panels) only go into side element slots, never the rack body.
- Side mounts go into a side element slot; the element kind decides which devices it accepts.
  Zero-U devices default to the first free accepting slot, dedicated kinds first (PDU bay, other,
  then sidepod).
- Optic connector must match the port group connector.

## In-rack cabling

- **Estimated length** (auto mode): horizontal run from each endpoint to the chosen side channel
  (half the rack body width for rack-mounted devices; for side-mounted devices the distance through the
  side elements to the body edge, plus the full body width when they sit on the opposite side), plus the
  vertical distance between the endpoints' heights (RU/OU centre or side-slot centre), plus 0.5 m slack;
  rounded up to the next 0.5 m. A manual length overrides it.
- **Drawing**: every run is drawn on the elevation as one polyline per cable: out of the start device to
  its lane in the chosen side's rail channel, along the channel, into the end device. Each side's runs get
  separate nested lanes (longest run outermost) so runs on one side never cross. Lines use the cable media
  color; the selected run is highlighted; clicking a run selects it.
- Endpoints are drawn at the device's vertical centre; port-level position is not drawn. Multi-connector
  runs are drawn as one stub per endpoint joined by a spine in the run's lane.
- **Checks** (shown on the run): every A endpoint must mate with the cable's A connector and every B
  endpoint with the B connector (MPO-8 ≡ MPO-12 ferrule); no more endpoints than the end has connectors;
  a male (pinned) cable end on a transceiver port is pinned-to-pinned; a port leg may not be used by two
  runs. The editor shows the cable's used/unused fibers.

## Derived data (recomputed on every change)

- **Metrics**: used/total units, typical/max power (devices + optics), supply capacity (PDUs/shelves),
  total weight (rack + side elements + devices), warnings (over power, over load, supply < max draw, overlaps).
- **BOM**: shown as a tree — **Rack** → **Rack frame** (devices in rack units) and one node per side
  element (Sidepod L, PDU bay R… with the devices mounted in it) → each device line with its optics and
  port-attached cables as children; **In-rack cables** (runs by media and length) last. Same items in the
  same container merge (qty, labels in notes). Empty (Reserved) space is left out. CSV export stays flat
  (merged by item).
  Columns: Item, Category, Vendor / Model (PN), every custom property with `showInBom`, Qty, Unit W,
  Total W, Notes.

## UI

- Every design has an **abbreviation**: 1–4 upper-case letters/digits (e.g. `GPU`, `T0`, `CDU`),
  suggested from the name (word initials, or the first 4 letters of a single word) and editable in the
  New form and the inspector; shown on DC Layout rack tiles and as the sidebar badge. Older projects get
  one derived from the design name.
- Sidebar: rack designs grouped by template, with a text filter (name, template, device labels and
  names); New (pick template), Duplicate, Delete.
- Sidebar layout: rack designs on top, **device palette below taking the rest**; the boundary is draggable
  (double-click resets; height saved in app preferences).
- Device palette: the Devices tree — Type → Item type → Items (vendor products); drag or double-click an
  item type (default item) or a specific item. Only devices of the rack's unit system are listed (RU racks
  take RU and 0U devices, OU racks OU and 0U); placing a device of the other system is rejected.
- Canvas: elevation (front/rear toggle) with side pods. Drag a device from the palette onto a unit or
  side slot — the pointer marks the device's middle and a tall device dropped near the top or bottom slides
  inside the rack; drag a placed device to move it; click to select.
- Canvas views: **Elevation** | **Cabling**, both with the front/rear toggle.
- **Cabling view**: one block per placed device (top unit first, side-mounted last) showing the chosen rack
  face **laid out like the faceplate** (groups left to right, each column-major over its rows; a rear-mounted
  device shows its rear-face ports from the front). Each **physical port** box shows its index and mode
  (`OSFP 8x100G`) and contains one box per **connector** (leg) with what runs on it — mode and reach split over
  the module's connectors: an 8x100G 2xDR4 port = 2 connectors, each `4x100G DR4` on `MPO-12`. Ports without a
  module connector (empty cage, DAC/AEC/AOC, RJ45, fiber ports) are one connector box. Cabled connectors take
  the run's media color; clicking one opens that run in the Cables tab. Device faceplates (Devices, Placement
  preview) show the same per-connector text (`2× 4x100G DR4`, details in the tooltip).
  - **Selecting**: press on a connector and drag across others to select them; starting on a selected one
    drags to deselect. Cabled connectors are skipped.
  - **Cable list** shows only cables that fit the selection: each end's connector mates, the fiber type
    matches the leg's reach (SMF/MMF), direct-attach speed matches the port; a cable that fits only the other
    way round (e.g. an MPO→4xLC breakout selected LC side first) is offered and laid reversed.
  - A end = connectors on the first device selected, B end = connectors on the other devices; a selection on
    one device only is split in halves. Each end is ordered by faceplate position.
  - **Assign** repeats the chosen cable over the selection: A taken `ends.a.count` at a time, B
    `ends.b.count` at a time, paired in order (SW1 1–10 + SW2 1–10 with a duplex cable = 10 runs; 2 MPO
    + 8 LC with a 1→4 breakout = 2 runs). Rejected when the counts do not divide or do not pair up, or a
    connector is already cabled. Route: left, right, or auto (the side with the shorter estimate per run).
- Inspector tabs: **Placement** (label, position, face, profile, group optics, per-port overrides by
  clicking ports on a faceplate preview), **Cables** (start/end device + port, route left/right, media,
  auto/manual length, quantity; selecting a device pre-fills new runs' start), **BOM** (metrics + BOM
  table, CSV export).
- **Errors are marked in red on the rack** (theme danger color): a placement with a problem (overlap —
  both devices —, does not fit, wrong unit system, side slot) gets a red outline, light red tint and a
  "!" badge, its tooltip lists the problems; a cable run with issues (connector mismatch, too many ends,
  pinned-to-pinned, leg used twice) gets a red casing; rack-wide problems (max power over rack rating or
  supply, payload over load) frame the rack body in red with the messages in red under the drawing. The
  drop target turns red while dragging to a place the device cannot go. The canvas title bar shows
  "⚠ N problems".
- Export SVG of the elevation.

**Cabling view port blocks**: each physical port is a compact block — its number on top, then one cable
block per connector leg side by side, each three lines: lanes / reach / connector (a 1x1.6T OSFP running
8x200G on a 2xDR4 module = two blocks "4x200G · DR4 · MPO-8"). All ports of a group share the block size;
the port's form factor and mode are in its tooltip.

**Delete device**: the canvas toolbar has "✕ Delete <label>" next to Export SVG, enabled when a device is
selected; the Delete / Backspace key does the same (ignored while typing in a field).
