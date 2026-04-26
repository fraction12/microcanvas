## Why

Large Mermaid diagrams currently render in Microcanvas, but the presentation layer can make them hard to use: custom dark node styles can become black-on-black because Microcanvas overrides label colors, and large diagrams are squeezed down until the text is too small to read. Mermaid support should behave like a navigable diagram canvas, not a static thumbnail.

## What Changes

- Preserve Mermaid-authored label colors and class styling instead of overriding diagram text with Microcanvas defaults.
- Present Mermaid diagrams in a pan/zoom viewport using the hybrid Option C behavior:
  - fit the diagram on first view when practical,
  - preserve a readable minimum scale instead of shrinking text into illegibility,
  - allow free navigation with panning and zoom controls.
- Add controls for common diagram navigation actions such as zoom in, zoom out, fit to view, and 100% scale.
- Keep Mermaid source semantics unchanged; this change is about presentation and viewer interaction.
- Ensure snapshots remain compatible with the Mermaid render path and do not regress visible export behavior.

## Capabilities

### New Capabilities

### Modified Capabilities
- `runtime-model`: Mermaid web surfaces gain explicit readability, styling-preservation, and pan/zoom navigation requirements.

## Impact

- `src/core/surface.ts`: Mermaid HTML/CSS/JS generation and readiness behavior.
- `apps/macos-viewer/MicrocanvasViewer/Sources/PresentedSurfaceSnapshotter.swift`: snapshot assumptions for rendered Mermaid SVGs may need validation if viewport wrappers change.
- `test/cli.test.mjs` and native viewer tests: add or update coverage for generated Mermaid presentation behavior and snapshot compatibility.
- No CLI command or Mermaid source syntax changes are expected.
