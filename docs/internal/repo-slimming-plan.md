# Microcanvas Slimming Plan

## Goal

Slim the repository and make the tool more efficient without deleting useful capability or muddying the architecture.

This should become an OpenSpec change before implementation. The plan below is the discovery shape: what to measure, what to split, and where to reduce weight.

## Current Shape

- Tracked repository content is small: about 123 files and roughly 3.6 MB.
- Local workspace weight is mostly generated or dependency output:
  - `node_modules`: about 166 MB
  - Swift `.build`: about 190 MB
- Main code hotspots:
  - `src/core/surface.ts`: surface detection, safety, transforms, HTML shell, staging
  - `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`: viewer state and behavior
  - `apps/macos-viewer/MicrocanvasViewer/Sources/PresentedSurfaceSnapshotter.swift`: snapshot orchestration
- Main dependency hotspot:
  - `mermaid` brings a large runtime tree for one supported surface type.

## Recommended Direction

Use an architecture-first cleanup with measured footprint and runtime wins.

```
Microcanvas
  CLI shell
    commands, output, contracts
  Core runtime
    paths, locks, state, manifest
  Surface pipeline
    adapters: html, markdown, csv, mermaid, image, pdf, text
    html shell and styling
    staging and materialization
    path safety
  Viewer bridge
    native launch
    viewer state
    snapshots
  macOS viewer
    presentation model
    rendering views
    snapshot coordinator
```

This keeps behavior stable while giving us cleaner places to optimize.

## Three Workstreams

### 1. Footprint

Reduce package, install, and local workspace weight.

- Confirm npm package contents stay minimal with `npm run pack:dry-run`.
- Archive completed OpenSpec changes so active work is easier to scan.
- Keep build output and runtime state invisible to normal searches.
- Audit whether Mermaid should remain a direct runtime dependency, become optional, or be lazily copied only for diagram surfaces.

### 2. Code Maintainability

Split large files by responsibility without changing behavior.

- Extract surface adapters from `src/core/surface.ts`.
- Extract HTML document generation and CSS shell from surface materialization.
- Extract CSV and Mermaid rendering helpers.
- Split viewer model responsibilities into state, presentation updates, readiness, and snapshot coordination where Swift boundaries support it.
- Keep public CLI command behavior stable.

### 3. Runtime Efficiency

Measure before optimizing.

- Capture baseline timings for `render`, `show`, `update`, `verify`, and `snapshot`.
- Measure cold native viewer launch vs warm viewer reuse.
- Measure Mermaid render overhead separately from markdown, CSV, image, and PDF.
- Add regression checks for large documents and tall snapshots.

## Proposed Success Budgets

- `npm pack --dry-run` contains only source-owned distribution files, docs, license, package metadata, and the Microcanvas skill.
- No generated build folders appear in `git ls-files`.
- No core TypeScript file exceeds about 450 lines without a documented reason.
- No Swift source file exceeds about 450 lines without a documented reason.
- Common render paths remain behavior-compatible and covered by tests.
- Mermaid support is justified by an explicit packaging decision.

## Implementation Sequence

1. Create OpenSpec change: `slim-runtime-and-codebase`.
2. Add baseline footprint and runtime measurement tasks.
3. Archive completed OpenSpec changes that are already validated.
4. Refactor `src/core/surface.ts` into adapters, safety, HTML shell, and staging.
5. Refactor macOS viewer hotspots along existing Swift test boundaries.
6. Audit Mermaid dependency strategy.
7. Run full verification:
   - `npm run check`
   - `npm test`
   - `npm run pack:dry-run`
   - `swift test`
   - `openspec validate slim-runtime-and-codebase --strict`

## Key Decision Needed

The first optimization priority should be chosen before writing the OpenSpec proposal:

- Install and package size
- Runtime speed
- Codebase maintainability

Recommended default: codebase maintainability first, with footprint and runtime measurements guarding the work.
