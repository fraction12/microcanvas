## Design

Microcanvas should allow flexible source locations without weakening the runtime's presentation boundary.

The core design move is simple:

- **Accept source paths from anywhere the local process can read**
- **Ingest them into a Microcanvas-owned staged surface directory**
- **Render and present only from that staged copy and the active promoted artifact**

This keeps the UX broad and the trust boundary narrow.

## Design principles

1. **Ingest, do not directly present arbitrary paths**
   - The original source path is an input to ingestion, not a long-lived presentation dependency.
   - The viewer should never need arbitrary read access to the caller's source tree.

2. **Source location and presentation location are different things**
   - Users should be free to keep files where they naturally live.
   - Microcanvas should still own the presentation artifact lifecycle in `runtime/staging` and `runtime/active`.

3. **Preserve safe-by-default local presentation**
   - Existing HTML-like hardening still applies after ingestion.
   - External ingest widens where content may come from, not what the viewer is allowed to do with it.

4. **Deterministic surface state**
   - Once a surface is staged, its presentation should depend on the staged copy and its materialized artifacts, not on late reads from the original path.
   - This keeps results reproducible and tool-friendly.

## Wedge A: External source ingest model

Commands that accept a source file (`render`, `show`, `update`) should accept supported paths from outside the repo root.

When a caller passes a source path:
1. resolve and validate the path exists and is a supported source file
2. read or copy the source into a surface-owned staged source location
3. perform any transformation or sanitization from that staged copy
4. materialize the final presentation artifact in the staged surface directory
5. on `show`, promote the staged surface into the active surface as usual

The original source path may be recorded as metadata for debugging or operator inspection, but the viewer must not depend on it.

## Wedge B: Path safety after broadening source acceptance

The current hardening work rejects out-of-root paths because root containment was the easiest way to make the trust boundary legible. With external ingest, that constraint should move.

The new safety rule should be:
- the source file may live anywhere readable by the process
- the file must still be a direct local file path, not a URL
- the path must not depend on disallowed traversal tricks
- symlink policy must be explicit

Recommended policy for this change:
- allow ordinary absolute and relative local file paths
- canonicalize before ingestion
- reject broken paths and unsupported schemes
- reject symlinked input files and symlinked ancestor directories by default in this pass, unless later product work explicitly chooses a looser import policy

That keeps the security posture conservative even while broadening usability.

## Wedge C: Surface-owned staged sources

Each staged surface should have a clear distinction between:
- the ingested source copy
- the rendered or display-ready primary artifact
- the manifest metadata

Suggested shape inside a staged surface directory:
- `source/` or equivalent for the ingested original payload when useful
- `index.html`, copied binary, or other primary artifact used by the viewer
- `manifest.json`

This supports future debugging and update semantics without requiring live access to the original source path.

## Wedge D: Update semantics

`update` should remain a surface-refresh operation, but the ingest model introduces two slightly different modes:

1. **Update from a new caller-provided source path**
   - Caller passes a path.
   - Microcanvas ingests that path and replaces the staged source/artifact for the active surface.

2. **Update from the previously remembered source path**
   - Optional future enhancement.
   - If Microcanvas remembers the last ingested original path for a surface, it may re-read it on update.

For this pass, the safer and simpler contract is:
- `update <path>` ingests that path and refreshes the active surface
- no background watching or implicit file syncing
- remembered-original-path behavior is optional and not required for v1 of this change

## Wedge E: Runtime metadata

Manifest/runtime state should make the ingest model legible.

Useful metadata may include:
- whether the source was ingested from an external path
- normalized original source path or a redacted/operator-safe variant
- staged source path if retained
- primary artifact path
- viewer mode and verification status as today

This should help tooling answer questions like:
- what file did this surface come from?
- is the viewer showing a staged copy or a generated artifact?
- can I safely replace/update this surface?

## Security posture

This change is safe if and only if Microcanvas keeps the presentation boundary narrow.

That means:
- the viewer reads only from staged Microcanvas-owned directories
- HTML-like hardening still applies to staged HTML-like surfaces
- JavaScript remains disabled on the default local web-surface path
- external source paths do not translate into broader `WKWebView` read scope

In other words, this change should broaden **ingest flexibility**, not **viewer privilege**.

## Test strategy

Add regression coverage for:

### External ingest behavior
- show a supported markdown file from outside repo root
- show a supported image or csv from outside repo root
- confirm the active artifact is materialized under runtime-owned paths
- confirm command success does not require source relocation into the repo

### Update behavior
- show from external path, then update from a second external path
- confirm the active surface is refreshed from the new staged copy
- confirm surface identity/update semantics remain coherent

### Security invariants
- verify HTML-like external inputs are still sanitized on the default path
- verify native viewer mode still reads from staged active content only
- verify unsupported schemes/paths are rejected clearly
- verify the chosen symlink policy still holds

## Rollout recommendation

Implement this in one focused change:
1. broaden accepted source-path resolution
2. add explicit ingest/copy flow into staged surface directories
3. keep render/show/update pointed at staged copies only
4. add metadata and tests
5. document the new source-versus-presentation model clearly

That gives Microcanvas a much better product shape without puncturing the security story.