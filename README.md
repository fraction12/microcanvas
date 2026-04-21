# microcanvas

A lightweight, reliable canvas runtime and viewer for AI coding tools.

Microcanvas is a standalone, tool-agnostic canvas tool that covers the same core job as OpenClaw Canvas, but in a smaller, more predictable form. Agents call Microcanvas like any other tool. Microcanvas owns rendering, activation, verification, and viewer-backed snapshots.

## What works today

- `render` renders a supported source into staging
- `show` activates a surface and opens or reuses the native viewer, including explicit image-surface coverage for png, jpg/jpeg, gif, and webp, plus deterministic CSV-to-table rendering
- `update` refreshes the active surface while preserving surface identity
- `status` reports runtime and viewer state
- `verify` checks both active surface files and viewer-reported state
- `snapshot` captures a real PNG from the native viewer window

## Supported content today

Microcanvas is deliberately honest about supported formats.

Supported now:
- `.html`, `.htm`
- `.md`, `.markdown`
- `.pdf`
- `.csv` (rendered into a deterministic HTML table surface)
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- `.txt`, `.json`, `.js`, `.ts` (wrapped into an HTML code-view surface)

Not supported yet:
- arbitrary binary artifacts
- archives like `.zip`
- `.svg` and other image-like formats without an explicit display path
- office docs and other formats without an explicit render/display path

If a file type is not supported, Microcanvas returns `UNSUPPORTED_CONTENT` instead of pretending success.

## Current viewer model

- native macOS viewer
- single active window
- single active surface at a time
- `wkwebview` surfaces for html, generated html, and CSV-backed table surfaces
- native PDF display for pdf surfaces
- native image display for png, jpg/jpeg, gif, and webp surfaces
- viewer heartbeat written into runtime state
- viewer-backed verify and snapshot flows

## Runtime model

Microcanvas keeps a canonical runtime root with:
- `runtime/active/`
- `runtime/staging/`
- `runtime/snapshots/`
- `runtime/state.json`
- `runtime/viewer-state.json`
- request/response files used for viewer snapshot handoff

## Safety stance

- no path traversal
- no symlink escapes
- source paths must resolve inside allowed roots
- unsupported formats fail clearly

## Internal structure

Surface detection and materialization now run through a lightweight adapter registry in `src/core/surface.ts`.
Each supported family declares its extensions, manifest/viewer contract, and any deterministic transform in one place, which keeps the refactor explicit and reversible without changing CLI behavior.

## Current status

This is now a working prototype with a real native viewer, viewer-backed verification, real PNG snapshots, write-lock discipline, and regression coverage around the core command flows.
