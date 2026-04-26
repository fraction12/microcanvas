## 1. Mermaid Label Readability

- [x] 1.1 Add or preserve fixtures for default Mermaid, large styled Mermaid, and the Local Computer Operator Model Architecture diagram.
- [x] 1.2 Test Mermaid `htmlLabels: false` against the fixtures and compare label readability, wrapping, layout, and snapshot compatibility.
- [x] 1.3 Implement the chosen Mermaid label strategy so dark styled nodes render light source-authored labels.
- [x] 1.4 Add regression assertions that custom Mermaid colors win over Microcanvas defaults.

## 2. Generated Surface Theme Tokens

- [x] 2.1 Replace scattered generated HTML color values with shared neutral workbench CSS tokens in `src/core/surface.ts`.
- [x] 2.2 Remove beige, tan, orange, and teal as dominant generated-surface defaults.
- [x] 2.3 Update Markdown/text/code styling to use the neutral workbench theme.
- [x] 2.4 Update CSV table styling to use the neutral workbench theme while preserving table readability.
- [x] 2.5 Update Mermaid shell, viewport, toolbar, source panel, and error styling to use the neutral workbench theme.

## 3. Native Viewer Chrome

- [x] 3.1 Align image surface background, frame, border, and shadow with the neutral workbench direction without altering image pixels.
- [x] 3.2 Align PDF surface background with the neutral workbench direction where supported by the native PDF view.
- [x] 3.3 Align fallback/empty/error cards with the neutral workbench direction.

## 4. Regression Coverage

- [x] 4.1 Add CLI tests that generated Markdown, CSV, and Mermaid HTML use shared neutral tokens and do not contain the old dominant beige/teal/orange palette.
- [x] 4.2 Add Mermaid regression coverage for dark styled nodes with light labels, including the Local Computer Operator architecture fixture.
- [x] 4.3 Add or update native viewer tests for image/PDF/fallback chrome where practical.
- [x] 4.4 Verify snapshots still capture readable Mermaid output after the label strategy and theme updates.

## 5. Validation

- [x] 5.1 Run TypeScript checks and focused CLI tests for generated surfaces.
- [x] 5.2 Run relevant native viewer tests.
- [x] 5.3 Validate the OpenSpec change.
