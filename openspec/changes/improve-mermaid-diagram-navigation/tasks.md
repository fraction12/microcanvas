## 1. Mermaid Styling

- [x] 1.1 Remove or narrow Microcanvas Mermaid label color overrides so Mermaid-authored class and theme text colors win.
- [x] 1.2 Verify dark custom Mermaid nodes render with readable light text while default diagrams remain readable.

## 2. Navigable Diagram Viewport

- [x] 2.1 Add stable Mermaid viewport and stage markup around the rendered SVG without changing Mermaid source semantics.
- [x] 2.2 Implement initial hybrid scaling: fit when readable, otherwise initialize at the readable minimum scale and center the diagram.
- [x] 2.3 Implement pan behavior for oversized diagrams using pointer interaction and stable transform state.
- [x] 2.4 Add explicit zoom controls for zoom in, zoom out, fit to view, and 100% scale.
- [x] 2.5 Ensure large diagrams do not force surrounding page layout shifts or collapse the viewer frame.

## 3. Snapshot Compatibility

- [x] 3.1 Keep the rendered Mermaid SVG discoverable to the native snapshot path or update the snapshot selector in lockstep.
- [x] 3.2 Verify Mermaid snapshots still wait for rendered SVG readiness and do not capture blank output.
- [x] 3.3 Confirm default snapshot output is deterministic and not dependent on transient live pan or zoom state.

## 4. Regression Coverage

- [x] 4.1 Add or update CLI tests for generated Mermaid HTML structure, controls, and absence of forced dark label overrides.
- [x] 4.2 Add fixture coverage for a large custom-styled Mermaid diagram with dark nodes and light text.
- [x] 4.3 Run relevant TypeScript, CLI, and native viewer tests for the touched paths.
- [x] 4.4 Validate the OpenSpec change after implementation.
