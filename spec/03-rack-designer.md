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
- **Drawing**: the elevation draws **links**, not single cables: all runs joining the same set of devices on
  the same side channel are one link (one device pair = at most one line per side, however many cables; a
  breakout joining 3+ devices is its own link). Left and right runs are never merged: each stays on its own
  side. A link is drawn on every rack face one of its ends is on (port group face, flipped for a rear-mounted device;
  PSU inlets are rear; a device in a PDU bay is on the rear): front-to-front cables only on the front panel,
  any cable with a rear end on the rear panel (front-to-rear on both). A link runs out of each device to its
  lane in its side channel, along the channel and into the other devices. Each side's links get separate nested lanes (longest outermost) so
  links on one side never cross. The tooltip names the devices, the cable count and the media; the colour is
  the media colour when all its cables share one, else neutral. Clicking a link opens its first run; selecting
  any run highlights its link. Lines are thin (1.25 px) in the
  cable media color, one lane per run at least 2.5 px apart: the side channels widen with the run count. Only
  the selected run (thin selection-colored casing, slightly thicker line, on top) and faulty runs (red casing) get a casing; while
  a run is selected every other run is drawn in a faint neutral close to the paper;
  clicking a run selects it, clicking empty space clears it.
- Endpoints are drawn at the device's vertical centre; port-level position is not drawn. Multi-connector
  runs are drawn as one stub per endpoint joined by a spine in the run's lane.
- **Checks** (shown on the run): every A endpoint must mate with the cable's A connector and every B
  endpoint with the B connector (MPO-8 ≡ MPO-12 ferrule); no more endpoints than the end has connectors;
  a male (pinned) cable end on a transceiver port is pinned-to-pinned; a port leg may not be used by two
  runs. The editor shows the cable's used/unused fibers.

## Derived data (recomputed on every change)

- **Metrics**: used/total units, typical/max power (devices + optics), supply capacity (PDUs/shelves),
  total weight (rack + side elements + devices), warnings (over power, over load, supply < max draw, overlaps).
- **BOM**: shown as a tree — the **rack as a whole** (the design, named after it; a group) → **Rack frame —
  <template>** (the rack template as the rack item line, qty 1, with the devices in rack units below it), and
  at the same level one node per side element (Sidepod L, PDU bay R… with the devices mounted in it) → each device line with its optics and
  port-attached cables as children; **In-rack cables** (runs by media and length) last. Same items in the
  same container merge (qty, labels in notes). Empty (Reserved) space is left out. CSV export follows the tree:
  rows in tree order with a leading **Level** column (rack as a whole = 0, rack frame / side elements / in-rack
  cables = 1, devices = 2, their optics and cables = 3); group rows carry only Level and Item.
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
- Colors (fixed, after the rack-elevation drawings): warm beige rails / unit column and side pods (`#f5efe6` /
  `#f2ece2`, tan lines); each device category is a light pastel fill, a mid-tone outline and dark text of the same
  hue — switches blue, console servers green, servers teal, patch panels lavender, power slate violet, fillers grey
  (normal-weight text), reserved space grey-blue dashed. The palette swatch uses the same fill and outline.
  Red / orange / yellow stay reserved for errors and warnings.
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
    drags to deselect. Cabled connectors select the same way (selecting one also opens its run); Assign
    is rejected while the selection holds a cabled connector.
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

**Delete device**: the canvas toolbar has an icon-only ✕ button (tooltip "Delete <label> (Del)") next to Export SVG, enabled when a device is
selected; the Delete / Backspace key does the same (ignored while typing in a field).

**Devices on both faces**: a rack-mounted device is drawn on its mount face and, faded (dashed), on the other face
when it is full depth or has ports there (PSU inlets, rear ports), so cables to those ports have an end to draw.

**PDU bays on the rear**: the front panel of the elevation leaves out the PDU bays and the PDUs in them; they are
drawn (and droppable) on the rear panel only.

**No face toggle**: the elevation draws front and rear side by side (drop / drag on either; the mount face is
the panel under the pointer). The cabling view also shows **front and rear side by side**, each device on one
line across both, so a rear port can be cabled to a front one. Power is cabled there too: PDU **outlets**
(C13 / C19) and each device's **PSU inlets** (`psu/1..n`, derived from `psus`, form factor = inlet C14 / C20;
busbar-fed devices have none). IEC power connectors mate only with their counterpart (C13↔C14, C19↔C20);
built-in cords: C13-C14, C19-C20.

**Cabling view layout**: rack devices front | left side PDUs, rack devices rear, right side PDUs — PDU bays are
on the rear, so the side PDUs flank the rear block. Side-mounted devices stack top to bottom in their side's column (element order, then slot),
each drawn vertically (groups stacked, 2 ports per line, front and rear groups together). Rack devices keep
one row per device across front and rear; each device box shrinks to its own ports (a rear face with only
PSU inlets is a small box).

**Elevation cables**: when no cable is drawn (none, or all hidden by the Devices / Cables filters) the channels are dropped too; runs use a cable channel (gutter) outside the rails on each side, between the frame and the side elements,
so the unit numbers on the rails stay visible; stubs leave each device near its top edge.

**Duplicate device**: next to the toolbar's ✕ Delete button, an icon-only ⧉ button (Ctrl+D; tooltip names the device) copies the selected
device — same item, height, breakout profile and port settings — with the next free label (SW1 -> SW2), mounted
right above the source, else at the closest free unit (0U devices: first free side slot). Cables are not copied.
The copy becomes the selection; with no room the toolbar reports it.

**Device filter (Elevation and Cabling)**: both views share one filter (per design). In the elevation, hidden
devices stay in place but are drawn faded and links touching them are not drawn. The canvas toolbar has a **Devices n/m ▾** button right
before the zoom buttons (highlighted while some are hidden). It drops down a checkbox per placed device (fillers
left out), the count of links drawn, and **All** / **None**; outside click or Escape closes it. Unchecked devices
are not drawn, and neither is any link with an end on one of them (a link is drawn only when both its devices
are checked). Drawing only: selection, Assign and cross-rack marks work on the full design. Kept per design for
the session (not saved).

**Cable filter (Elevation and Cabling)**: a **Cables n/m ▾** dropdown after Devices lists every cable item used in
the design (the leaf items of Optics / Cables, so a Y-cable or a shuffle can be picked on its own), grouped under
its type heading (DAC, AEC, AOC, Power, SMF, MMF, Other) in the Optics / Cables order, each with its cable count.
Runs of an unchecked item are not drawn. Modules (transceivers) are not cables and are not listed. Kept per design
for the session (not saved).

**Views (Elevation and Cabling)**: a **Views n/2 ▾** dropdown (toolbar order: Views, Devices, Cables, then zoom) with Front and Rear (both by default; at least one
stays checked). With one face only that panel / block is drawn, starting at the left edge; the Cabling view's
side PDUs belong to the rear block. Session only.

**Cross-rack ports**: in the cabling view, **Mark cross-rack** marks the selected connectors as leaving the rack
(`design.crossRack[]`, same endpoint shape as cable ends: placement + port + connector leg). The button reads
**Unmark cross-rack** when every selected connector is already marked and removes the marks. A connector with an
in-rack cable cannot be marked, and Assign rejects a cross-rack connector. Marked connectors are drawn teal with a
⇄ badge (tooltip "cross-rack"); the bar shows the count. Deleting a device drops its marks. DC Layout assigns
trunk cables to these ports.

**Cable list with one end selected**: while only one end is selected (one device's connectors), the Cable list
shows every cable with an end that fits those connectors — a C20 PSU inlet lists the C19-C20 cord, a C14 inlet
the C13-C14 cord — instead of going empty until the other end is picked.

**Cable lines in the cabling view**: every assigned cable is drawn as lines between its connectors, in the
cable's colour — one line per A–B connector pair (a 1:1 cable is one line, a breakout fans out to each B end).
Lines follow the run's **route** like the elevation. **Front and rear each have their own left and right cable
channel** (ch | FRONT | ch || left PDUs | ch | REAR | ch | right PDUs); each line leaves its connector to the gap
above or below its device row (the nearer), runs along the gap to the route's channel of its own face block,
along its lane, and back in. A front-rear run climbs its lane to the band above the devices, crosses to the other
face's channel on the same route side and comes down there. Side PDUs (both sides) use the rear block's channels. Per channel, runs get nested lanes by vertical span (shortest innermost), so runs in one channel
never cross. Drawn on top of the devices; hover shows
both ends; clicking a line opens its run.
**Highlight**: every run on a selected connector plus the run selected in the Cables tab is highlighted
(hover changes nothing) — its lines drawn thick on top, its connectors outlined — and dims every other run. Clicking the selected run again, clicking empty space
or pressing Escape clears the selected run (and the connector selection), so nothing stays highlighted.
