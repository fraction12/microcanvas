## Context

Microcanvas currently materializes Mermaid sources as generated HTML in `src/core/surface.ts`, loads Mermaid in a `WKWebView`, and renders a diagram SVG into `.diagram-render-output`. The current presentation treats the SVG like normal responsive page content: it caps the SVG at the frame width and applies Microcanvas label color defaults. That works for small diagrams, but it breaks down for architecture-scale diagrams that rely on custom Mermaid classes and need spatial navigation.

There is also an active snapshot-fidelity change for rendered web surfaces. This proposal should stay compatible with that work: the live viewer can gain pan/zoom behavior without changing Mermaid source semantics or making exported snapshots blank again.

## Goals / Non-Goals

**Goals:**

- Preserve Mermaid-authored styling, including class-defined text colors for dark nodes.
- Make large Mermaid diagrams readable by preventing automatic shrink-to-unreadable behavior.
- Provide Option C navigation: fit on first view when reasonable, enforce a readable minimum scale, and allow panning/zooming around oversized diagrams.
- Keep Mermaid diagrams usable with mouse, trackpad, and explicit controls.
- Preserve snapshot/export compatibility for rendered Mermaid SVGs.

**Non-Goals:**

- Do not change Mermaid syntax, parse Mermaid sources, or rewrite user-authored diagrams.
- Do not introduce a general-purpose canvas framework for every web surface.
- Do not make snapshot output depend on the user's current pan/zoom viewport unless a future change explicitly adds that mode.
- Do not solve Mermaid's own graph layout choices; Microcanvas only controls presentation and navigation after Mermaid renders.

## Decisions

1. **Let Mermaid own diagram label colors**

   Remove or narrow Microcanvas CSS rules that force `.label`, `.nodeLabel`, or `.edgeLabel` to a single dark color. Mermaid theme defaults may still provide a readable baseline, but source-level `classDef` and Mermaid-generated styles must win for nodes that explicitly define colors.

   Alternative considered: keep Microcanvas label overrides and detect dark fills. This is brittle because Mermaid emits different SVG/HTML label structures across diagram types, and users already have a native styling language in Mermaid.

2. **Use a pan/zoom viewport around the rendered SVG**

   Wrap the rendered Mermaid SVG in a stable viewport element with a transformable stage. The stage should support drag-to-pan and zoom controls while keeping layout dimensions stable. The SVG remains the rendered Mermaid artifact inside that stage.

   Alternative considered: natural-size scroll only. It is simpler, but large diagrams become tedious to navigate and do not provide a good first-view overview. Pure fit-to-width is the current failure mode because it makes text too small.

3. **Use hybrid initial scaling**

   On render, compute the SVG bounds and viewport bounds. If the diagram can fit without sacrificing readability, center and fit it. If fitting would shrink below the readable minimum scale, initialize at that minimum scale and center the diagram, leaving the user to pan. Provide explicit fit-to-view and 100% actions so the user can switch between overview and detail.

   Alternative considered: always start at 100%. This preserves text but loses the structural overview. Hybrid behavior gives a useful first impression without pretending every diagram can fit legibly.

4. **Keep snapshot capture full-diagram oriented**

   Existing snapshot logic detects rendered Mermaid SVGs and can rasterize the SVG directly. The implementation should keep that path working by leaving a discoverable rendered SVG in `.diagram-render-output` or updating the snapshot selector in lockstep. The default snapshot should represent the full rendered diagram, not the current viewport transform.

   Alternative considered: snapshot the current pan/zoom viewport. That is useful, but it is a separate product behavior and would make automated verification less deterministic.

## Risks / Trade-offs

- Custom viewport code could introduce input quirks across mouse and trackpad → Keep controls explicit, use pointer events for drag, and test basic keyboard/mouse-free controls.
- Mermaid SVG structure may vary across diagram types → Keep DOM assumptions minimal and target the wrapper/stage Microcanvas owns.
- Snapshot selectors may miss the SVG after wrapper changes → Add regression coverage or explicit verification for the Mermaid snapshot path.
- A readable minimum scale means some diagrams will not fully fit on first view → This is intentional; readable text is preferred over a false full-diagram thumbnail.
- Very large SVGs may still be visually complex → The viewer improves navigation but does not replace better source decomposition for extremely dense diagrams.
