# Optics & Cables

The **Optics & Cables** module (tab after Racks) manages the pluggable/pigtail optics and the cable
media used by device ports, rack designs and in-rack cable runs. Built-in items ship as one JSON file
per item (`src/catalog/optics/`, `src/catalog/cables/`); project items are stored in the project file
(`optics[]`, `cableMedia[]`). Built-ins are read-only (Duplicate to edit), as in the other catalogs.

## Layout

- **Sidebar**: one tree, filterable — `Optics / <family> / <speed>` and `Cables / <type>`.
  - Families, in this order: **OSFP**, **QSFP-DD** (8-lane double density, its own folder), **QSFP**
    (the 4-lane variants QSFP+, QSFP28, QSFP56, QSFP112), **SFP** (SFP+, SFP28…). The exact form factor
    is the item's badge.
  - Speed folders sort high to low (1.6T, 800G, 400G, 200G…; speeds from 1000G are shown in T); items inside sort by reach from short to long
    (DAC, SR, DR, FR, LR, ER, ZR; lane multiplier breaks ties: DR4 < 2xDR4 < DR8).
- **Built-in catalog** covers every family/speed with the common reach classes (illustrative values):
  SR, DR, FR, LR, ER and ZR where the speed class has them. "+ New" offers
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
| `fiberConnector` | Connector a cable must mate with: module face (`MPO-12`, `2x MPO-12`, `LC`) or the pigtail end connector |
| `pigtail` | Pigtail only: `{ count, connector, fiberType, lengthM }` — number of fiber legs, end connector, `fiber-sm`/`fiber-mm`, leg length |
| `powerW`, `weightKg` | Power and weight per optic |

For a pigtail optic `fiberConnector` is derived from the pigtail (`count > 1` → `"<count>x <connector>"`),
so cable compatibility and BOM cable counts work the same as for modules: the patch cable must match
the pigtail end connector, and a 2-leg pigtail needs two cables per port.

## Cable

A cable has two **ends**, A and B. Each end is a set of identical connectors, so one model covers
patch cords, breakouts, Y-cables, shuffles, multi-leg trunks and asymmetric cables.

| Field | Meaning |
|---|---|
| `type` | `fiber-sm`, `fiber-mm`, `copper-dac` (DAC), `aec` (active electrical, retimed copper), `aoc` (active optical), `power`, `other` |
| `speedGbps`, `powerWPerEnd` | Direct-attach cables (DAC / AEC / AOC) only: link speed, and draw of each active plug (0 for passive DAC) |
| `ends.a`, `ends.b` | `{ count, connector, fibers, gender }` — number of connectors on that end, connector type (`LC`, `MPO-8`, `MPO-12`, `MPO-16`, `MMC-16`, `OSFP`…), fibers **used** per connector, `male` (pinned) / `female` (unpinned); gender only for MPO/MMC |
| `fiberCount` | Fibers in the cable body (e.g. 160 for a 160F trunk) |
| `mapping` | `straight` — fibers run in order (A fiber 1 → B fiber 1 across connectors); `shuffle` — every A connector's fibers are split evenly over all B connectors (4x4, 2x2, 2xMMC-16 → 4xMPO-8) |
| `polarity` | MPO/MMC only: `A` (key-up to key-down, straight-through), `B` (key-up to key-up, fiber positions reversed), `C` (pair-wise flip) |
| `vendor`, `model` | Optional vendor and model / vendor PN |
| `maxLengthM`, `color` | Longest supported length (optional); drawing color |

Examples (all built-in):

| Cable | A end | B end | Mapping |
|---|---|---|---|
| LC duplex patch | 1x LC (2F) | 1x LC (2F) | straight |
| MPO-12 → 4x LC breakout | 1x MPO-12 (8F) | 4x LC (2F) | straight |
| Y-cable MMC-16 → 2x MPO-8 | 1x MMC-16 (16F) | 2x MPO-8 (8F) | straight |
| 4x4 shuffle | 4x MPO-8 | 4x MPO-8 | shuffle (2F from each A to each B) |
| 2x2 shuffle | 2x MPO-8 | 2x MPO-8 | shuffle (4F from each A to each B) |
| 2x MMC-16 → 4x MPO-8 shuffle | 2x MMC-16 | 4x MPO-8 | shuffle (4F from each A to each B) |
| 160F MPO-8 trunk | 20x MPO-8 (male) | 20x MPO-8 (male) | straight |
| Asymmetric MMC-16 → MPO-8 | 1x MMC-16 (16F) | 1x MPO-8 (8F) | straight, 8 A fibers unused |
| Asymmetric 2x MMC-16 → 2x MPO-8 | 2x MMC-16 | 2x MPO-8 | straight, 8 fibers unused per A connector |

### Derived

- **Fiber map**: list of `(A connector, fiber) → (B connector, fiber)` for the used fibers. Fibers used =
  min(A total, B total); the rest of the larger end is reported as **unused**. With `straight`, fibers are
  numbered across connectors in order; with `shuffle`, A connector *i* sends its group *j* to B connector
  *j*, landing at position group *i*. Polarity `B` reverses fiber positions within each connector on the
  B side; `C` swaps adjacent pairs.
- **Connector mating**: MPO-8 and MPO-12 share the 12-position ferrule and mate with each other; `MMC`
  and `MMC-16` are the same connector. Other connectors mate only with themselves.
- **Gender**: transceiver fiber receptacles are pinned (male), so a male cable end on a module port is
  flagged (pinned-to-pinned).

### UI

- Inspector: General, Media (type, fiber count, color), **A end** and **B end** (count, connector,
  fibers per connector, gender), **Mapping** (straight/shuffle, polarity) with the derived used/unused
  fiber summary.
- Canvas: A connectors on the left, B connectors on the right, one line per connected A→B connector
  pair labelled with its fiber count; shuffle lines cross; unused fibers listed under the drawing.
  Multi-fiber connectors are named with their gender everywhere they are shown (drawings, sidebar
  badges, summaries, Rack Designer): `MMC-16F` = female (unpinned), `MMC-16M` = male (pinned); duplex
  connectors (LC, SN, CS) and ends without a gender keep the plain name. Transceiver faces are pinned
  (`2x MPO-12M`); pigtail legs carry their own gender (built-in pigtail legs are female).
  Ends with more than 8 connectors show the first 4 and the last 3 with the middle elided
  ("⋮ 13 more"), so the last connector number (e.g. A20 of a 160F MPO-8 trunk) stays visible.

Lengths are per use (rack cable runs choose or estimate them), not per cable media.

## Direct-attach cables (DAC, AEC, AOC)

DAC, AEC and AOC are **cables, not optics**: each end is a module plug (`OSFP`, `QSFP-DD`, `QSFP28`…) that
goes straight into a cage, with no transceiver. On a port, the reach list offers `DAC` / `AEC` / `AOC`
when the catalog has such a cable whose plug fits the cage and whose `speedGbps` equals the port mode's
total speed; picking one hides the Module field and the Cable list shows only cables of that kind. Active
plugs (AEC retimers, AOC optics) add `powerWPerEnd` per port to rack power and appear in the BOM with
that unit power. Fiber cable lists never offer direct-attach cables. Built-ins: DAC 100G QSFP28 /
400G QSFP-DD / 800G OSFP; AEC 400G QSFP-DD / 800G OSFP / 1.6T OSFP; AOC 100G QSFP28 / 400G QSFP-DD /
800G OSFP (illustrative lengths and power). The former DAC "optics" were removed; project port settings
that pinned them now set reach `DAC` and the matching DAC cable.

## Custom properties

Property definitions can target `device`, `rack`, `optic` and `cable`. Optic and cable lines in the
BOM show the values of `showInBom` properties.
