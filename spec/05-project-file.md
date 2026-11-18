# Project file and catalog

## Project file

A single JSON file (`*.dclab.json`):

```json
{
  "schema": "dc-lab/project@1",
  "name": "My project",
  "devices": [], "racks": [], "optics": [], "cableMedia": [],
  "rackDesigns": [], "layouts": [],
  "hiddenBuiltins": [],
  "propertyDefs": [],
  "builtinProperties": {}
}
```

- **Open** replaces the current project and remembers the chosen file.
- **Save** writes back to the remembered file. With no file yet (new project) Save behaves like Save As.
- **Save As** asks for a file location and name, writes there, and remembers it.
- **⟳ Reload** (next to Open ▾, Ctrl+R): re-reads the open file from disk after editing it outside the app and
  replaces the project with it (no prompt); disabled until a file is open.
- Ctrl+S = Save, Ctrl+Shift+S = Save As, Ctrl+O = Open, Ctrl+R = Reload (Ctrl+Shift+R still reloads the page). The current file name is shown in the top bar.
- File access uses the browser File System Access API (Chrome / Edge). Browsers without it
  (Firefox, Safari) fall back to opening with an upload dialog and saving as a download.
- **Open** is a clean start: the current project (and its unsaved changes) is replaced by the file, with no
  prompt; Save then writes to that file. There is no Import (merge) action.
- The project is never stored in the browser (no `localStorage` autosave): a page reload starts with an empty
  project and the file is opened again (Open / Open ▾ recent). Only the open module tab survives a reload.
  While there are unsaved changes, leaving or reloading the page asks for confirmation.

`hiddenBuiltins` is kept for file compatibility and always loads empty: built-in items cannot be deleted, and
ones hidden by older versions come back.

## Custom properties

`propertyDefs[]` defines project-wide custom properties. A definition applies to every device and/or
every rack template as soon as it exists:

| Field | Meaning |
|---|---|
| `id`, `name` | Identity and display name, e.g. `"Lead time"` |
| `appliesTo` | `["device"]`, `["rack"]` or both |
| `type` | `text`, `number`, `boolean`, `select` |
| `options` | Choices for `select` |
| `unit` | Optional unit suffix for `number`, e.g. `"weeks"` |
| `defaultValue` | Value used when an item has none |
| `showInBom` | When true, the property is a BOM column (rack and DC BOM, CSV export) |

Values live on the item: `device.properties[propertyId]` / `rack.properties[propertyId]`. Built-in items
are read-only, so their values are stored in the project under `builtinProperties[itemId]` and merged in
when the item is resolved. Values of a deleted definition are ignored. Exported device/rack JSON
includes its values.

## Built-in catalog

`src/catalog/<kind>/<id>.json`, one item per file, loaded at build time. Kinds: `devices`, `racks`,
`optics`, `cables` (see [08-optics-cables.md](08-optics-cables.md)).

## Item ids

Ids are lowercase kebab-case. Project items with a built-in id shadow the built-in.
