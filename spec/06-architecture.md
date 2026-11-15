# Architecture

Vite + React + TypeScript (strict) + Zustand. Vitest for domain tests.

```
src/
  domain/       Pure TypeScript model + logic, no React. One concept per file.
    units.ts
    device/     types, categories (traits registry), breakout, ports
    rack/       types
    optics/     types (optics + cable media)
    design/     types, placement rules, metrics
    bom/        bom-builder, rack-bom, dc-bom
    layout/     types, tile rules, layout metrics
    library/    Library: resolves ids over built-in catalog + project
    project/    project type, serializer, import/merge, factories
  catalog/      Built-in JSON items + loader
  state/        Zustand store split into slices
  ui/           Reusable components (shell, sidebar, fields, svg canvas)
  features/     One folder per module: devices, racks, optics, designer, layout
  io/           File download/upload, SVG/CSV export
```

File naming: every source file and folder is **kebab-case** (`rack-elevation.tsx`, `use-library.ts`,
`bom-builder.ts`); the exported symbol keeps its own casing (`RackElevation`, `useLibrary`, `BomBuilder`).

Principles: domain is framework-free and unit-tested; components are small and single-purpose;
SVG drawings use presentation attributes (not CSS classes) so exported SVG renders standalone.

Build: `npm run build` emits `dist/` (relative base) deployed to GitHub Pages by
`.github/workflows/pages.yml`.

## Performance

- Designs and the library are immutable snapshots, so derived data (rack metrics, design issues, BOM lines and
  tree, cabling-view layout) is cached per `(library, design)` object pair (`memoByDesign`, WeakMap); switching
  racks or re-rendering with an unchanged design reuses it. Duplicate-connector checks use one per-design count
  map instead of comparing every run with every other.
- Large drawings keep element counts low: an elevation cable run is a few `<path>`s however many ends it has;
  the cabling view draws its devices, connectors and lines once per design (memoized), with delegated events and
  one hover read-out instead of per-element tooltips; the selection / highlight is a light overlay on top.
- The Cables tab builds the editor only for the open run.
- The project autosave to `localStorage` is debounced (400 ms, flushed before unload).
