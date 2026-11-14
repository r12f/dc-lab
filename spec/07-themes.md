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
└── highlightPalette        # color rotation for user highlights
```

Area mapping:

| Theme field | Used by |
|---|---|
| `tab.*` | Top module tabs (focused = active module), inspector sub-tabs, top bar background |
| `header` | Table header rows (BOM, row metrics) |
| `surface.selected` | Selected sidebar item, selected table row |
| `canvas.paper/ink` | Drawing background and text |
| `canvas.frame/frameText/slot` | Rack rails, unit numbers, empty unit fill; also the optic cage block and DC Layout row headers. Dark themes invert Light: Light has a dark frame with light text on white paper, so dark themes use a light frame (the theme's secondary text color) with dark text. Frame vs paper ≥ 3:1, frame text ≥ 4.5:1 (tested). |
| `canvas.selection` | Selection outlines on every canvas. Always a blue: red/amber/yellow are reserved for warnings, so a selection must never look like an error. |
| `canvas.onFill` | Text drawn on palette-colored fills (placed devices, assigned racks) |
| `highlightPalette` | User highlight colors. Not used for device categories: category colors are a fixed calm set (blues, teals, purples, greys) and faceplate borders are neutral grey, because red/amber are reserved for warnings. |

Hot/cold aisle fills (blue/red) and device internals (faceplate metal, port cages, breakout fan-out colors, PDU phase colors, PSU
modules) are physical/data encodings and stay fixed across themes.

## Contrast rules

Text on accent (`general.onAccent`), panel text and focused tab text must reach WCAG 4.5:1. Dark presets
derive `onAccent` automatically: the preset's focused-fg if readable on the accent, else the better of
the theme's text and base colors. A unit test enforces these ratios for every theme.

## Built-in themes

| Id | Description |
|---|---|
| `mizuiro` | Clear aqua: deep navy base with water blue and sky blue |
| `landmine` | Jirai Kei: black base with pink and red accents |
| `amai` | Sweet Lolita: dark rose base with candy pink and lavender |
| `maid` | Classic maid: black and white high contrast with wine red |
| `gyaru` | Shibuya bold: dark bronze base with gold and hot pink |
| `dopamine` | Rainbow maximalist: warm black base with neon pink, sunflower yellow, electric blue |
| `light` | Light: white panels, slate text, blue accent |
| `dark` | Dark: GitHub-style near-black with light blue accent |

Exact values live in `src/theme/presets/<id>.ts`, one file per theme.

## Selection and persistence

- Theme picker in the top bar, ordered **Light**, **Dark**, **System**, a separator, then the style themes. Each option shows
  its description as a tooltip.
- **Default = System**: the app uses `light` or `dark` according to the OS/browser `prefers-color-scheme`
  and switches live when the OS setting changes.
- Picking a theme stores its id in browser storage (`dc-lab:prefs`, an app preference — not part of the
  project file and not affected by New/Open). The next launch uses the same theme. Picking **System**
  clears the stored choice.
- Unknown/removed stored ids fall back to System.

## SVG export

Canvas SVG uses `var(--…)` paints. Export replaces every `var(--name)` with the computed value, so
exported files are standalone and match the theme active at export time.
