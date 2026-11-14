# Rack Designer (L11)

A **rack design** (`schema: "dc-lab/rack-design@1"`) is a rack template populated with devices.

## Model

- `templateId` — rack template.
- `placements[]` — a device instance:
  - `deviceId`, `label` (instance id, e.g. `T0-1`)
  - `mount`: `{ kind: "rack", position, face }` (bottom unit, 1-based) or `{ kind: "side", side, slot }`
  - `breakoutProfileId` — one of the device's profiles (optional); supplies default mode/optic/cable per port
  - `portConfig[portRef]` — per-port `breakout` override and `opticId`
  - `groupOptics[groupId]` — default optic for every port in a group
- `cables[]` — in-rack cable runs: `from`/`to` endpoints (`placementId`, `portRef`), `mediaId`,
  `lengthM`, `quantity`.

## Rules

- A rack-mounted device occupies `[position, position + units - 1]`; it must fit within the template and
  must not overlap another device on the same face (full-depth devices block both faces:
  a device is full-depth when `depthMm > template.depthMm / 2`).
- Zero-U devices go into side-pod slots; only categories with the zero-U trait may.
- Optic connector must match the port group connector.

## Derived data (recomputed on every change)

- **Metrics**: used/total units, typical/max power (devices + optics), supply capacity (PDUs/shelves),
  total weight (rack + devices), warnings (over power, over load, supply < max draw, overlaps).
- **BOM**: rack template x1, devices by id, optics by id (instance > profile), port-attached cables from
  profiles (quantity), in-rack cable runs by media (quantity, total length).
  Columns: Item, Category, Vendor/Model, Qty, Unit W, Total W, Notes.

## UI

- Sidebar: rack designs; New (pick template), Duplicate, Delete.
- Canvas: elevation (front/rear toggle) with side pods. Drag a device from the palette onto a unit or
  side slot; drag a placed device to move it; click to select.
- Inspector tabs: **Placement** (label, position, face, profile, group optics, per-port overrides by
  clicking ports on a faceplate preview), **Cables**, **BOM** (metrics + BOM table, CSV export).
- Export SVG of the elevation.
