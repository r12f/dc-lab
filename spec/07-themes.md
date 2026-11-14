# Themes

All UI and canvas colors come from a single `Theme` object. Components never use color literals for
chrome; they read CSS custom properties generated from the active theme.

## Theme structure

```
Theme
├── id, name, description   # description: one line, style inspiration + primary colors
├── scheme                  # light | dark (sets the browser color-scheme for native controls)
├── general                 # accent, onAccent, text, muted, subtle, border
├── surface                 # app, panel, panelAlt, selected, hover, input, inputBorder
├── tab                     # focused {fg,bg}, unfocused {fg,bg}, barBg — module tabs + sub-tabs
├── header                  # {fg,bg} — table headers
├── status                  # danger, warn, ok — warnings, errors, validation
├── dialog                  # border, title, text, muted, selected {fg,bg} — menus, cards, notices
├── canvas                  # paper, ink, inkMuted, grid, frame, frameText, slot, selection, onFill
└── highlightPalette        # color rotation; device categories use palette[i % length]
```

Area mapping:

| Theme field | Used by |
|---|---|
| `tab.*` | Top module tabs (focused = active module), inspector sub-tabs, top bar background |
| `header` | Table header rows (BOM, row metrics) |
| `surface.selected` | Selected sidebar item, selected table row |
| `canvas.paper/ink` | Drawing background and text |
| `canvas.frame/frameText/slot` | Rack rails, unit numbers, empty unit fill |
| `canvas.selection` | Selection outlines on every canvas |
| `canvas.onFill` | Text drawn on palette-colored fills (placed devices, assigned racks) |
| `highlightPalette` | Device category colors (rack elevation, palette swatches, faceplate border) |

Hot/cold aisle fills (blue/red) and device internals (faceplate metal, port cages, breakout fan-out colors, PDU phase colors, PSU
modules) are physical/data encodings and stay fixed across themes.

## Contrast rules

Text on accent (`general.onAccent`), panel text and focused tab text must reach WCAG 4.5:1. Dark presets
derive `onAccent` automatically: the preset's focused-fg if readable on the accent, else the better of
the theme's text and base colors. A unit test enforces these ratios for every theme.

## Built-in themes

| Id | Description |
|---|---|
| `mizuiro` | Clear aqua: deep navy base with water blue and sky blue (default) |
| `landmine` | Jirai Kei: black base with pink and red accents |
| `amai` | Sweet Lolita: dark rose base with candy pink and lavender |
| `maid` | Classic maid: black and white high contrast with wine red |
| `gyaru` | Shibuya bold: dark bronze base with gold and hot pink |
| `dopamine` | Rainbow maximalist: warm black base with neon pink, sunflower yellow, electric blue |
| `light` | Light: white panels, slate text, blue accent |
| `dark` | Dark: GitHub-style near-black with light blue accent |

Exact values live in `src/theme/presets/<id>.ts`, one file per theme.

## Selection and persistence

- Theme picker in the top bar; each option shows the description as a tooltip.
- The chosen theme id is stored in browser storage (an app preference, not part of the project file).
- Unknown/removed ids fall back to the default (`mizuiro`).

## SVG export

Canvas SVG uses `var(--…)` paints. Export replaces every `var(--name)` with the computed value, so
exported files are standalone and match the theme active at export time.
