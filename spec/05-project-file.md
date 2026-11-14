# Project file and catalog

## Project file

A single JSON file (`*.dclab.json`):

```json
{
  "schema": "dc-lab/project@1",
  "name": "My project",
  "devices": [], "racks": [], "optics": [], "cableMedia": [],
  "rackDesigns": [], "layouts": [],
  "hiddenBuiltins": []
}
```

- **Open** replaces the current project and remembers the chosen file.
- **Save** writes back to the remembered file. With no file yet (new project, or after a page reload)
  Save behaves like Save As.
- **Save As** asks for a file location and name, writes there, and remembers it.
- Ctrl+S = Save, Ctrl+Shift+S = Save As, Ctrl+O = Open. The current file name is shown in the top bar.
- File access uses the browser File System Access API (Chrome / Edge). Browsers without it
  (Firefox, Safari) fall back to opening with an upload dialog and saving as a download.
- **Import** merges a project file's (or a single item file's)
  devices / racks / optics / cable media into the current project (same id = replaced).
- The working project is also autosaved to `localStorage`.

`hiddenBuiltins` lists built-in item ids deleted in this project; they are excluded from every list.

## Built-in catalog

`src/catalog/<kind>/<id>.json`, one item per file, loaded at build time. Kinds: `devices`, `racks`,
`optics`, `cables`.

## Item ids

Ids are lowercase kebab-case. Project items with a built-in id shadow the built-in.
