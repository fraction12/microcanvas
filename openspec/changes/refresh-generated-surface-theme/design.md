## Context

Generated web surfaces currently share `buildHtmlDocument` styling in `src/core/surface.ts`. That styling gives Markdown, text-like sources, CSV tables, and Mermaid diagrams a warm beige page, translucent paper card, orange/yellow/teal accent strip, and several one-off colors. Native image/PDF presentation has separate Swift chrome with system colors and a translucent white image frame.

The current result is inconsistent: generated surfaces feel over-styled, Mermaid diagrams inherit a surrounding palette that can fight diagram semantics, and the remaining black-on-black Mermaid labels suggest that source-authored styling is not yet reliably preserved. The design direction should make Microcanvas feel intentional without making content look like Microcanvas authored it.

## Goals / Non-Goals

**Goals:**

- Establish a neutral workbench theme for generated surfaces: crisp canvas, graphite text, quiet gray structure, and one restrained accent.
- Remove beige, tan, orange, and teal as dominant default surface colors.
- Centralize generated-surface colors as named CSS tokens so future surfaces reuse one palette.
- Preserve source-authored content colors and styling, especially Mermaid `classDef` colors.
- Fix Mermaid dark-label readability for styled nodes, including a deliberate decision on `htmlLabels`.
- Align native image/PDF/fallback chrome with the neutral workbench direction.
- Add regression coverage that prevents the old palette and black-on-black Mermaid behavior from returning.

**Non-Goals:**

- Do not create a full brand system, marketing page, or logo refresh.
- Do not recolor source content such as images, PDFs, user HTML, or Mermaid nodes with explicit styles.
- Do not add a third-party design system or CSS framework.
- Do not redesign the whole macOS viewer navigation/chrome outside the supported surface presentation areas.

## Decisions

1. **Use a neutral workbench palette**

   Generated surfaces should use near-white and cool-gray surfaces, graphite text, subtle gray borders, and a restrained blue accent. This keeps content legible and avoids the current beige/teal mood.

   Candidate token direction:
   - `--surface-bg`: `#f6f7f9`
   - `--surface-canvas`: `#ffffff`
   - `--surface-raised`: `#f9fafb`
   - `--surface-ink`: `#111827`
   - `--surface-muted`: `#5b6472`
   - `--surface-line`: `rgba(17, 24, 39, 0.14)`
   - `--surface-soft-line`: `rgba(17, 24, 39, 0.08)`
   - `--surface-accent`: `#2563eb`
   - `--surface-accent-soft`: `rgba(37, 99, 235, 0.10)`

   Alternative considered: use macOS system colors everywhere. That is good for native chrome, but generated HTML artifacts should remain deterministic and visually consistent when exported or opened outside the app.

2. **Make chrome opinionated, not content**

   Microcanvas-owned wrappers, controls, tables, source panels, and empty/error states may use the workbench tokens. User content must keep its own semantics: images and PDFs are not recolored, raw HTML is not restyled through the generated wrapper, and Mermaid explicit classes must win over Microcanvas defaults.

   Alternative considered: enforce a single Microcanvas palette across all surface content. That makes screenshots consistent but breaks diagrams and source-authored meaning.

3. **Treat Mermaid label readability as a first-class compatibility issue**

   The implementation should test whether `flowchart.htmlLabels: false` preserves `classDef color` more reliably for styled nodes. If it does, prefer SVG labels for Mermaid flowcharts. If disabling HTML labels causes unacceptable layout regressions, implement the narrowest compatibility fix that maps Mermaid class/style color onto HTML label content without overriding unstyled diagrams.

   Alternative considered: keep `htmlLabels: true` and rely on Mermaid defaults. The observed black-on-black behavior makes that too fragile.

4. **Use one token set across generated Markdown, CSV, and Mermaid**

   Generated Markdown/text, CSV tables, Mermaid shell, source details, buttons, and error text should consume the same CSS tokens. Format-specific CSS may change layout, density, or controls, but not invent unrelated colors.

   Alternative considered: tune each format independently. That is how the current palette drift happened.

5. **Align native image/PDF chrome without touching content**

   Image and PDF surfaces should use the same neutral workbench feel for backgrounds, frames, and fallback cards. The rendered image/PDF content itself remains untouched.

   Alternative considered: leave native surfaces alone. That would preserve inconsistency between generated web surfaces and native-presented surfaces.

## Risks / Trade-offs

- Neutral theme could feel too plain -> Mitigate with careful spacing, typography, subtle elevation, and one crisp accent.
- Switching Mermaid `htmlLabels` may alter label wrapping or layout -> Test with simple diagrams, the large styled fixture, and the Local Computer Operator architecture fixture before committing.
- Removing warm colors may affect existing snapshot expectations -> Update tests to assert semantic tokens and absence of the old palette rather than brittle screenshots.
- Native and generated surfaces use different rendering stacks -> Keep token values mirrored in Swift where practical and document any unavoidable platform differences.
- User-authored Mermaid themes may still conflict internally -> Preserve source semantics and surface errors/readability regressions through fixtures rather than guessing.
