## Why

Microcanvas generated surfaces currently use a warm beige/teal presentation theme that feels arbitrary and can compete with user-authored content. The Mermaid black-on-black issue also shows that the renderer needs a clearer rule: Microcanvas may be opinionated about chrome, but source-authored visual semantics must win.

## What Changes

- Replace the beige/teal generated-surface theme with a neutral workbench theme that feels technical, calm, and sharp.
- Define shared presentation tokens for generated HTML surfaces instead of scattering one-off colors across Markdown, CSV, and Mermaid rendering.
- Make Mermaid defaults neutral and readable while preserving user-authored Mermaid colors and styles.
- Investigate and fix the remaining Mermaid dark-label issue, including whether `htmlLabels: true` should be disabled or replaced with a targeted compatibility fix.
- Align native image/PDF viewer chrome with the same neutral workbench direction without recoloring source content.
- Add regression coverage for theme tokens, Mermaid styled-node readability, and representative generated surfaces.

## Capabilities

### New Capabilities

### Modified Capabilities
- `runtime-model`: Supported surface presentation gains explicit theming, source-style preservation, and Mermaid readability requirements.

## Impact

- `src/core/surface.ts`: generated HTML theme tokens, Markdown/table/Mermaid surface CSS, and Mermaid initialization options.
- `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`: native image/PDF/fallback chrome alignment.
- `test/cli.test.mjs` and fixtures: generated HTML and Mermaid regression coverage.
- Native viewer tests may need updates if image/PDF chrome behavior is asserted.
- No CLI command or supported-source syntax changes are expected.
