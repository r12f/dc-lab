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

- **Open** replaces the current project. **Import** merges a project file's (or a single item file's)
  devices / racks / optics / cable media into the current project (same id = replaced).
- **Save** downloads the project file. The working project is also autosaved to `localStorage`.

`hiddenBuiltins` lists built-in item ids deleted in this project; they are excluded from every list.

## Built-in catalog

`src/catalog/<kind>/<id>.json`, one item per file, loaded at build time. Kinds: `devices`, `racks`,
`optics`, `cables`.

## Item ids

Ids are lowercase kebab-case. Project items with a built-in id shadow the built-in.
