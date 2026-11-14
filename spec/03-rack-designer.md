# Rack Designer (L11)

A **rack design** (`schema: "dc-lab/rack-design@1"`) is a rack template populated with devices.

## Model

- `templateId` — rack template.
- `placements[]` — a device instance:
  - `deviceId`, `label` (instance id, e.g. `T0-1`)
  - `mount`: `{ kind: "rack", position, face }` (bottom unit, 1-based) or `{ kind: "side", elementId, slot }`
    (slot in a rack side element, 1 = top)
  - `breakoutProfileId` — one of the device's profiles (optional); supplies default mode/optic/cable per port
  - `portSettings[portRef]` / `groupSettings[groupId]` — instance `{ mode, opticId, cableId }` overriding the profile
- `cables[]` — in-rack cable runs:
  - `from` — A end; `to[]` — B end(s): one for a straight cable, up to the cable's breakout leg count
    for a breakout cable (e.g. MPO-12 → 4x LC)
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
- Endpoints are drawn at the device's vertical centre; port-level position is not drawn. A breakout
  run is drawn as one trunk from the A end with one branch per B leg in the same lane.
- **Checks** (shown on the run): the A end must mate with the cable's A connector, each B end with the
  cable's B connector (the breakout leg connector, or the A connector for a straight cable); a leg may
  not be used by two runs; a breakout cable may not have more B ends than legs.

## Derived data (recomputed on every change)

- **Metrics**: used/total units, typical/max power (devices + optics), supply capacity (PDUs/shelves),
  total weight (rack + side elements + devices), warnings (over power, over load, supply < max draw, overlaps).
- **BOM**: rack template x1, devices by id, optics by id (instance > profile), port-attached cables from
  profiles (quantity), in-rack cable runs by media (quantity, total length).
  Columns: Item, Category, Vendor / Model (PN), every custom property with `showInBom`, Qty, Unit W,
  Total W, Notes.

## UI

- Sidebar: rack designs grouped by template, with a text filter (name, template, device labels and
  names); New (pick template), Duplicate, Delete.
- Canvas: elevation (front/rear toggle) with side pods. Drag a device from the palette onto a unit or
  side slot; drag a placed device to move it; click to select.
- Inspector tabs: **Placement** (label, position, face, profile, group optics, per-port overrides by
  clicking ports on a faceplate preview), **Cables** (start/end device + port, route left/right, media,
  auto/manual length, quantity; selecting a device pre-fills new runs' start), **BOM** (metrics + BOM
  table, CSV export).
- Export SVG of the elevation.
