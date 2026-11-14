# Item types and items

Devices, optics and cables are organised in three levels:

| Level | Example | Holds |
|---|---|---|
| **Type** | Switch, OCS, Patch Panel, PDU (devices); OSFP, QSFP, SFP (optics); Single-mode fiber, DAC (cables) | grouping only — device category, optic family, cable type |
| **Item type** | 32x400G QSFP-DD Switch · 800G OSFP 2xDR4 · MPO-12 SMF trunk | the technical definition: ports, size, power, PSUs (devices); form factor, speed, reach, connector (optics); ends, mapping (cables) |
| **Item** | Acme SW-6400 · Acme OSFP-800G-2DR4 | a concrete purchasable product of the item type: `vendor`, `model` (model / vendor PN), custom property values |

## Model

`ItemVariant` (`schema: "dc-lab/item@1"`): `id`, `target` (`device` | `optic` | `cable`), `itemId` (the item
type), `vendor`, `model`, `properties`, `isDefault?`. Stored in the project's `variants[]`. An item type may
have any number of items; the one marked `isDefault` (else the generic item) is its default.

- Every item type has a generic item `<itemId>--generic` (vendor `Generic`, model = item type name),
  synthesized by the library. For built-in item types it is read-only like other built-ins (custom
  property values still editable, stored in `builtinProperties[<itemId>--generic]`); for project item
  types editing it saves a project item with that id.
- Users add items to any item type, built-in or not, without duplicating the item type.
- Custom properties with targets `device` / `optic` / `cable` apply to **items**; `rack` stays on racks.

## Use

- Rack Designer placements choose an item (`variantId`; empty = default item). The placement panel lists
  the item type's items.
- BOM: device lines are keyed by item; `Vendor / Model (PN)` and custom property columns come from the
  item. Optic and cable lines use the item type's default item.

## UI (Devices, Optics & Cables)

- Sidebar tree: **Type → Item type → Item**. Item types are selectable rows that expand to their items;
  the badge shows the item count.
- Selecting an item type shows its drawing and the technical editor. Selecting an item shows the same
  drawing, the item editor (vendor, model, custom properties) on top and the read-only/edited item type
  below.
- Actions: **+ New** creates an item type (template picker); **+ Item** adds an item to the selected item
  type; Duplicate / Delete act on the selection; **Make default** moves an item first.

## Migration

Older projects stored `vendor`, `model` and `properties` on devices, optics and cables. On load each such
project item type gets its generic item `<id>--generic` saved with those values. Property values that
older projects stored under a built-in item type id are read as values of its generic item.
