## Why

Microcanvas already records where a shown surface came from, but the native viewer does not give users a way to return to recently shown documents or visuals. A collapsible source-history panel makes the viewer feel persistent and navigable without storing private source content in repo-local or shared state.

## What Changes

- Add a private application-support history index that records metadata for recently shown source files, not copies of the source documents.
- Record successful source-backed `show` and `update` operations into that history, deduped by canonical source path, newest first, capped at 50 entries.
- Add a collapsible native viewer side panel that lists recent sources and lets the user reload an available source through the existing CLI `show` flow.
- Show missing original files as disabled history entries with a clear missing state.
- Keep viewer presentation bounded to Microcanvas staged/active runtime artifacts; history source paths are inputs to re-ingest, not direct viewer read targets.

## Capabilities

### New Capabilities
- `viewer-source-history`: Private recent-source history and native viewer selection behavior.

### Modified Capabilities
- `runtime-model`: Clarify that source history reuses the existing ingest/show model and does not widen the viewer presentation boundary.
- `transport-integration`: Clarify that viewer-initiated history reloads invoke the existing CLI show path.

## Impact

- Affected TypeScript runtime code: history metadata store, `show`/`update` recording, tests.
- Affected macOS viewer code: history decoding, side-panel UI, click-to-show process invocation, tests.
- New private local state outside the repository by default, under application support, with test override support.
- No new document-content storage and no changes to the source-versus-staged presentation security model.
