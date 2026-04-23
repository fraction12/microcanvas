## Why

Microcanvas currently renders Mermaid diagrams correctly in the live macOS viewer, but exported snapshots still come out blank. That means the user-facing snapshot/verify path is not faithfully capturing what the viewer actually shows.

This is a real product bug because snapshot output is part of the runtime contract, not just an internal implementation detail. If the live surface is correct and the snapshot is empty, the tool is lying about what it captured.

## What changes

This change fixes the web snapshot/export path so it captures the rendered visual result of local web surfaces, including Mermaid diagrams, instead of returning a blank or prematurely captured image.

The fix should:
- wait for the rendered surface to be ready
- capture the actual painted SVG/content, not the raw source
- preserve correct orientation and fidelity in the exported PNG
- keep live viewer behavior unchanged

## Success criteria

- A Mermaid surface that renders visibly in the live viewer also exports visibly in snapshot output.
- Snapshot output matches the rendered surface rather than blank source state.
- Existing runtime/show/verify behavior stays green.
- Regression tests cover the Mermaid snapshot case and prevent blank exports from returning silently.
