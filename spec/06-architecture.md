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
    bom/        BomBuilder, rackBom, dcBom
    layout/     types, tile rules, layout metrics
    library/    Library: resolves ids over built-in catalog + project
    project/    project type, serializer, import/merge, factories
  catalog/      Built-in JSON items + loader
  state/        Zustand store split into slices
  ui/           Reusable components (shell, sidebar, fields, svg canvas)
  features/     One folder per module: devices, racks, designer, layout
  io/           File download/upload, SVG/CSV export
```

Principles: domain is framework-free and unit-tested; components are small and single-purpose;
SVG drawings use presentation attributes (not CSS classes) so exported SVG renders standalone.

Build: `npm run build` emits `dist/` (relative base) deployed to GitHub Pages by
`.github/workflows/pages.yml`.
