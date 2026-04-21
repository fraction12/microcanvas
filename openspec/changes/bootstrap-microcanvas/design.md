## Design

Microcanvas should be a lightweight standalone canvas runtime and viewer that covers the same core use case as OpenClaw Canvas, but in a smaller, more predictable, tool-agnostic form.

### Core principles

1. **Match the core Canvas job**
   - Microcanvas should support the essential flows people actually want from OpenClaw Canvas: render, show, update, snapshot, and verify.
   - The goal is not to invent a different category of product.

2. **Own the viewer and runtime**
   - Microcanvas should provide its own simple app UI and own the full rendering and viewing loop.
   - All agents should interact with Microcanvas as clients of the same tool, rather than expecting agent-specific integration paths.

3. **No server dependency**
   - Microcanvas should not require a long-running local server in order to show surfaces.
   - The default viewer path should be a simple local app, not a browser app that depends on a background daemon.

4. **Single active surface, explicit locking**
   - v1 should support only one active surface at a time.
   - While Microcanvas is actively writing or mutating the displayed surface, other callers must wait and receive a clear try-again-later response.
   - Once writing is complete and the surface is shown, the tool becomes available again.

5. **Tiny surface area**
   - Start with a small CLI and a simple content/runtime/viewer model.
   - Use AgentTK for the CLI.
   - Avoid framework sprawl, custom platform lock-in, or heavy client architecture.

### v1 shape

- a local project/session directory for rendered surfaces
- a renderer that writes HTML and asset files deterministically
- a simple Microcanvas app that opens and displays rendered surfaces directly without requiring a background server
- an AgentTK-based CLI that supports render, show, update, snapshot, and verify flows
- one shared render/session model regardless of which agent invoked the tool
- one active surface at a time, guarded by a write lock during mutation
- content support oriented around showing whatever can reasonably be viewed, including HTML, PDFs, JavaScript/TypeScript output, and other viewable artifacts

### Clarifications needed for implementation

1. **Viewer shape**
   - v1 should use a single lightweight local app window.
   - The app should focus on showing the current active surface, not managing a multi-tab or multi-workspace UI.

2. **Surface replacement semantics**
   - `show` should replace the currently active surface.
   - v1 does not need surface history, multi-surface navigation, or concurrent workspaces.

3. **Lock boundary**
   - The write lock applies only while content is actively being written, updated, or swapped into place.
   - Once the new surface is fully materialized and visible, the lock is released.
   - Read-style operations like snapshot or verify should not hold the write lock unless they require a mutation.

4. **Explicit content support, no magical promises**
   - v1 should support only the artifact types that have an explicit implemented rendering or display path.
   - In practice today, that means HTML, Markdown, PDF, and selected text/code files that are wrapped into an HTML surface.
   - Unsupported formats should return `UNSUPPORTED_CONTENT` clearly instead of falling through to a fake or degraded success path.

5. **CLI contract should be machine-friendly**
   - The CLI should produce stable success/error output that agents can parse reliably.
   - Lock contention, invalid paths, unsupported content, and viewer launch failures should each return distinct, understandable results.
   - The core commands should be explicit and small: `render`, `show`, `update`, `snapshot`, `verify`, `status`.

6. **Non-goals for v1**
   - no multi-surface workspace manager
   - no collaborative session model
   - no agent-specific behavior branches
   - no A2UI-style protocol as a primary rendering path
   - no always-on background server
   - no heavy cross-platform app shell in v1

### Proposed viewer implementation for v1

#### Primary app choice

v1 should be a **native macOS app** with a single window.
The implementation should prefer the lightest practical native stack over a web-app shell.

A sensible direction is:
- Swift or SwiftUI app shell
- `WKWebView` for HTML-based surfaces
- native file opening/display paths for formats like PDF where the platform already has a good lightweight path

This keeps the viewer small, avoids a background server, and avoids dragging in Electron-class overhead just to show local artifacts.

#### Viewer responsibilities

The viewer should:
- open the current active surface
- reuse one window by default
- reload or swap to the new active surface when `show` succeeds
- expose enough state for `verify` and `status` to work

The viewer should not become a mini-IDE, workspace manager, or browser replacement.

#### Format handling model

The viewer implementation should be pragmatic:
- HTML-like surfaces: open through `WKWebView`
- PDF: use a native display path or a viewer path that remains lightweight and local
- other viewable artifacts: either map them to a supported native/web rendering path or transform them into one before display

The contract is not “render every file format natively.”
The contract is “show broadly viewable artifacts through explicit supported paths.”

#### Platform stance

v1 should be **macOS-first**.
Cross-platform support can come later, but it should not distort the first implementation.
The CLI and surface model should stay portable even if the first viewer is macOS-native.

### Proposed CLI contract for v1

#### Commands

1. `microcanvas render`
   - writes a new surface into the local surface root without necessarily displaying it
   - intended for preparing or replacing the canonical active surface payload

2. `microcanvas show`
   - renders if needed, then makes the target surface the active displayed surface in the viewer
   - if the viewer is already open, it reuses the same window

3. `microcanvas update`
   - mutates the currently active surface in place when a supported update path exists
   - if an in-place update path does not exist, it should fail clearly or replace via a defined fallback

4. `microcanvas snapshot`
   - captures an image or other defined snapshot artifact of the current active surface

5. `microcanvas verify`
   - checks whether the active surface was rendered and displayed successfully through defined verification hooks

6. `microcanvas status`
   - returns machine-readable runtime state including whether the viewer is open, whether a write lock is active, and what the active surface is

#### Input modes

The CLI should support a small number of explicit input paths:
- source file path
- rendered artifact path
- stdin for direct content where practical
- structured flags for title/type/output targets where needed

It should not require caller-specific conventions.

#### Output contract

The CLI should support a machine-readable mode that returns a stable object shape.
A reasonable v1 result model is:
- `ok: true|false`
- `code: <stable-status-code>`
- `message: <human-readable-summary>`
- `surfaceId: <optional>`
- `viewer: { open: true|false }`
- `lock: { held: true|false, reason?: string }`
- `artifacts: { primary?: string, snapshot?: string }`

#### Stable status codes

The CLI should define stable result codes for at least:
- `OK`
- `LOCKED_TRY_LATER`
- `INVALID_INPUT`
- `UNSUPPORTED_CONTENT`
- `VIEWER_LAUNCH_FAILED`
- `SURFACE_NOT_FOUND`
- `UPDATE_NOT_SUPPORTED`
- `VERIFY_FAILED`

#### Mutation rule

Mutating commands are:
- `render`
- `show`
- `update`

These commands must respect the write lock.
Non-mutating commands like `status` should not require the lock.
`snapshot` and `verify` should avoid taking the write lock unless their implementation actually mutates state.

### Proposed surface model for v1

#### Surface root

Microcanvas should maintain one canonical local surface root for v1 runtime state.
Inside that root, the implementation should keep a simple deterministic layout, for example:

- `state.json` — current runtime state
- `lock.json` — active write-lock metadata when present
- `active/` — the currently active surface directory
- `staging/` — temporary write area used during render/show/update before swap
- `snapshots/` — captured snapshot artifacts

The exact filenames may change, but the model should preserve these roles.

#### Active surface directory

The active surface directory should contain the fully materialized payload needed by the viewer.
A reasonable v1 shape is:

- `manifest.json` — metadata about the active surface
- `index.html` or primary entry artifact
- `assets/` — local supporting assets when needed
- additional source or derived files required by the chosen rendering path

#### Manifest metadata

The active surface manifest should be stable and machine-readable.
A reasonable v1 manifest shape includes:
- `surfaceId`
- `title`
- `contentType`
- `entryPath`
- `createdAt`
- `updatedAt`
- `sourceKind` such as `html`, `pdf`, `artifact`, `generated`
- `renderMode` describing how the viewer should open the surface

#### Render/show/update semantics against files

- `render` writes a complete candidate surface into staging and leaves it available for later use
- `show` ensures a candidate surface exists, then swaps it into `active/` and tells the viewer to display it
- `update` mutates the current surface only through a defined update path; otherwise it must fail clearly or rebuild through the render/show path
- swap into `active/` should be atomic as far as practical so the viewer never points at a half-written surface

#### Snapshot semantics

- `snapshot` writes snapshot artifacts into `snapshots/`
- snapshot output should reference the surface it came from
- snapshot should not rewrite the active surface unless the implementation explicitly requires it

### Implementation guardrails from OpenClaw Canvas

1. **Separate render model from display control**
   - OpenClaw Canvas separates content hosting from display control.
   - Microcanvas should keep the same discipline: rendering local output is one concern, displaying it is another.

2. **Prefer HTML/file surfaces over A2UI-like message protocols**
   - OpenClaw’s A2UI path is real but stricter and more brittle.
   - Microcanvas v1 should prefer deterministic HTML/file rendering as the primary path.

3. **Keep one canonical path model**
   - OpenClaw uses canonical hosted paths and a stable local file model.
   - Microcanvas should define one canonical surface/session path model and map its viewer cleanly onto it.

4. **Be strict about file safety**
   - OpenClaw rejects traversal and symlink-based escapes in hosted file resolution.
   - Microcanvas should do the same. No path traversal, no symlink escapes, no ambiguous root behavior.

5. **Do not encode agent-specific assumptions into the core runtime**
   - Microcanvas should behave the same regardless of whether the caller is OpenClaw, Claude, Codex, Cursor, or something else.
