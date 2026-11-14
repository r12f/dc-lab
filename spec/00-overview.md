# DC Lab — Overview

DC Lab is a browser-based prototyping tool for data center hardware design.
It is organized as five modules that build on each other:

| Module | Level | Purpose | Spec |
|---|---|---|---|
| Devices | L10 | Define single devices: ports, breakout profiles, power, size, weight | [01-devices.md](01-devices.md) |
| Racks | — | Define rack templates: units, dimensions, footprint tiles, limits | [02-racks.md](02-racks.md) |
| Optics & Cables | — | Define optics (pluggable modules and pigtail optics) and cable media | [08-optics-cables.md](08-optics-cables.md) |
| Rack Designer | L11 | Populate a rack template with devices, optics, cables; BOM + metrics | [03-rack-designer.md](03-rack-designer.md) |
| DC Layout | L12 | Rows, tiles, aisles, trays; assign rack designs to tiles; DC BOM | [04-dc-layout.md](04-dc-layout.md) |

Cross-cutting concerns: [05-project-file.md](05-project-file.md) (single-file JSON project,
built-in catalog), [06-architecture.md](06-architecture.md) (code structure) and
[07-themes.md](07-themes.md) (color themes), [09-item-variants.md](09-item-variants.md) (Type → Item type → Item).

## UI shell

- **Top tab bar** selects the module. Project actions (New / Open / Import / Save / Save As) and the theme picker live on the right of the bar.
- **Left sidebar** in every module lists the module's items (built-in and project), grouped, with **New**, **Duplicate** (⧉) and **Delete** (🗑) in its header; the icon buttons act on the selected item and are disabled when nothing is selected.
- **Main canvas** is an SVG drawing of the selected item. Every canvas supports **Export SVG**.
- **Right inspector** edits the selected item / sub-item.
- Sidebar and inspector widths are resizable by dragging the pane borders (180–1600 px, double-click resets; the canvas always keeps at least 240 px, side panes shrink on narrow windows).
  Widths are shared by all modules and saved as app preferences (`dc-lab:prefs`), restored on next launch.

## Built-in vs. project items

Built-in items ship with the app as one JSON file per item under `src/catalog/`. They are read-only;
"Duplicate" copies one into the project for editing. Project items override built-ins with the same id.

## Units

- `RU` = 44.45 mm (EIA-310), `OU` = 48 mm (Open Rack). Devices declare their height in either system;
  a device placed in a rack of the other system occupies `ceil(deviceMm / rackUnitMm)` units.
- Power in watts, weight in kilograms, dimensions in millimetres.

## Sample data

Built-in catalog values are illustrative placeholders for generic devices, not vendor datasheet values.
Verify every number against the vendor datasheet before using a design.
