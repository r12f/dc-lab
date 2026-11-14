# Optics & Cables

The **Optics & Cables** module (tab after Racks) manages the pluggable/pigtail optics and the cable
media used by device ports, rack designs and in-rack cable runs. Built-in items ship as one JSON file
per item (`src/catalog/optics/`, `src/catalog/cables/`); project items are stored in the project file
(`optics[]`, `cableMedia[]`). Built-ins are read-only (Duplicate to edit), as in the other catalogs.

## Layout

- **Sidebar**: one tree, filterable — `Optics / <form factor>` and `Cables / <type>`. "+ New" offers
  *Optic module*, *Pigtail optic* and *Cable*.
- **Canvas**: SVG drawing of the selected item (exportable):
  - module optic: module body with form factor, speed, reach, and its fiber connector face;
  - pigtail optic: module/engine body with the pigtail fiber(s) drawn out to the end connector(s),
    labelled with pigtail length and connector;
  - cable: two connector ends joined by the cable in its media color, labelled with type and connector.
- **Inspector**: fields below + custom properties (targets `optic` / `cable`) + JSON export.

## Optic

| Field | Meaning |
|---|---|
| `packaging` | `module` (pluggable, fiber connector on the module face) or `pigtail` (fiber permanently attached) |
| `vendor`, `model` | Vendor and model / vendor PN |
| `formFactor` | Host-side form factor (cage it plugs into, e.g. `OSFP`), or the engine/port form factor for a pigtail on a CPO/NPO port |
| `speedGbps`, `reach`, `reachM` | Total speed, reach class (`DR4`, `2xFR4`, `SR4`, `DAC`…), max reach in metres |
| `fiberConnector` | Connector a cable must mate with: module face (`MPO-12`, `2x MPO-12`, `LC`) or the pigtail end connector; empty for DAC/AOC |
| `pigtail` | Pigtail only: `{ count, connector, fiberType, lengthM }` — number of fiber legs, end connector, `fiber-sm`/`fiber-mm`, leg length |
| `powerW`, `weightKg` | Power and weight per optic |

For a pigtail optic `fiberConnector` is derived from the pigtail (`count > 1` → `"<count>x <connector>"`),
so cable compatibility and BOM cable counts work the same as for modules: the patch cable must match
the pigtail end connector, and a 2-leg pigtail needs two cables per port.

## Cable

| Field | Meaning |
|---|---|
| `type` | `fiber-sm`, `fiber-mm`, `copper-dac`, `aoc`, `power`, `other` |
| `connector` | Connector at the A end, and at both ends of a straight cable (`LC`, `MPO-12`, `MPO-16`, `MMC`, `OSFP` for DAC…) |
| `vendor`, `model` | Optional vendor and model / vendor PN |
| `fiberCount` | Fibers per cable (fiber types) |
| `maxLengthM` | Longest supported length (optional) |
| `color` | Drawing color (rack cable runs, port glyphs) |
| `breakout` | Breakout cables only: `{ count, connector }` — the B end fans out into `count` legs, each ending in `connector` (e.g. MPO-12 with 8 fibers → 4x LC duplex). The A end uses `connector`. |

Lengths are per use (rack cable runs choose or estimate them), not per cable media.

## Custom properties

Property definitions can target `device`, `rack`, `optic` and `cable`. Optic and cable lines in the
BOM show the values of `showInBom` properties.
