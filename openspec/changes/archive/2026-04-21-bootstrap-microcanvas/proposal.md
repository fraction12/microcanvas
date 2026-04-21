## Why

OpenClaw Canvas proves the idea, but we want a version of that capability that is lighter, more reliable, and usable from any AI coding tool.

Microcanvas should be a standalone canvas runtime and viewer that does the same essential job as OpenClaw Canvas:
- render lightweight visual surfaces
- show and update them predictably
- support snapshots and verification
- work directly for any coding tool
- treat all calling agents as clients of the same tool

The difference is that Microcanvas should be smaller, more deterministic, and easier for any tool to drive.

## What Changes

- create the initial Microcanvas project structure and product thesis
- define Microcanvas as a standalone canvas runtime and viewer that owns its own rendering and viewing model
- define the primary standalone runtime behavior for agent-driven usage
- define a lightweight CLI-first interface for rendering, showing, updating, snapshotting, and verifying canvas surfaces
- define the initial canonical specs for runtime model, viewer behavior, and client-facing tool behavior

## Impact

- creates a clean home for the project
- gives implementation work a spec-driven backbone from day one
- keeps the project focused on a lightweight, reliable canvas primitive instead of drifting into a bloated framework
