# runtime-model Specification

## Purpose
TBD - created by archiving change bootstrap-microcanvas. Update Purpose after archive.
## Requirements
### Requirement: Cover the core canvas runtime job
The system SHALL support the core canvas runtime flows of rendering, showing, updating, snapshotting, and verifying lightweight visual surfaces.

#### Scenario: Drive a surface through the main lifecycle
- **WHEN** a caller uses the system to work with a canvas surface
- **THEN** the system supports render, show, update, snapshot, and verify flows for that surface

### Requirement: Provide a primary standalone app viewer
The system SHALL use the Microcanvas viewer as the primary display path when it is available, while allowing a degraded external-open display path when the native viewer is unavailable.

#### Scenario: Show a surface through the Microcanvas viewer
- **WHEN** a caller asks the system to show a rendered surface and the Microcanvas viewer is available
- **THEN** the system opens and displays that surface through the Microcanvas viewer

#### Scenario: Fall back to degraded external display
- **WHEN** a caller asks the system to show a rendered surface and the Microcanvas viewer is unavailable but the active entry artifact can still be opened externally
- **THEN** the system opens the surface through the degraded external display path instead of failing immediately
- **AND** the runtime records that the surface is displayed in degraded mode rather than as a native viewer session

#### Scenario: Reuse the same viewer window
- **WHEN** the native viewer is already open and a caller asks to show a new surface
- **THEN** the system reuses the same viewer window for the new active surface instead of spawning an uncontrolled number of windows by default

### Requirement: Use a lightweight native viewer implementation for v1
The system SHALL prefer a lightweight native macOS viewer implementation for v1 over a heavy cross-platform app shell.

#### Scenario: Viewer implementation is chosen for v1
- **WHEN** the first viewer is implemented
- **THEN** it uses a lightweight native macOS path rather than introducing Electron-class overhead for the initial version

### Requirement: Use a file-first render model
The system SHALL render canvas surfaces into deterministic local files that can be inspected and reused across invocations, even when the original source file came from outside the repository root.

#### Scenario: Render a surface to local files
- **WHEN** a caller asks the system to render a surface
- **THEN** the system writes deterministic local output for that surface under Microcanvas-owned runtime paths
- **AND** the rendered output remains usable regardless of which agent invoked the tool or where the original supported local source file lived

### Requirement: Maintain a canonical surface root
The system SHALL maintain one canonical local surface root for runtime state in v1.

#### Scenario: Runtime state is materialized on disk
- **WHEN** the system prepares or displays a surface
- **THEN** it stores runtime state through a stable surface-root layout that distinguishes active content, staging content, snapshots, and runtime metadata

### Requirement: Materialize an active surface manifest
The system SHALL keep stable machine-readable metadata for the active surface.

#### Scenario: Caller inspects the active surface
- **WHEN** runtime state is queried or the viewer opens the active surface
- **THEN** the system can resolve the active surface through manifest metadata that identifies the surface, entry path, and render mode

### Requirement: Separate rendering from display invocation
The system SHALL preserve a clean separation between surface rendering and the act of displaying that surface.

#### Scenario: Reuse one rendered surface across callers
- **WHEN** a surface has already been rendered
- **THEN** the system can display it without redefining the render format or coupling rendering logic to one specific caller

### Requirement: Promote staged surfaces into the active surface predictably
The system SHALL promote staged rendered output into the active surface through a predictable swap process.

#### Scenario: Show replaces the active surface
- **WHEN** a caller shows a newly rendered surface
- **THEN** the system promotes the staged candidate into the active surface through an atomic or equivalently safe swap path so the viewer does not point at half-written content

### Requirement: Support one active surface at a time
The system SHALL support exactly one active surface at a time in v1.

#### Scenario: Replace the active surface
- **WHEN** a caller renders and shows a new surface
- **THEN** that surface becomes the one active displayed surface for the runtime

### Requirement: Lock during surface mutation
The system SHALL prevent concurrent mutation of the active surface while it is being written or updated.

#### Scenario: Second caller arrives during write activity
- **WHEN** one caller is actively writing or mutating the active surface and another caller attempts a mutation
- **THEN** the second caller receives a clear try-again-later response instead of proceeding concurrently
- **AND** once the write is complete, later callers may use the tool normally

#### Scenario: Read-style operation runs after write completion
- **WHEN** the active surface has been fully written and displayed
- **THEN** later non-mutating operations may proceed without being blocked by the earlier completed write

### Requirement: Support explicitly implemented viewable content
The system SHALL support only the viewable content formats that have an explicit implemented rendering or display path, and SHALL apply those paths consistently whether supported local source files originate inside or outside the repository root.

#### Scenario: Caller wants to show a supported artifact
- **WHEN** a caller asks the system to show a supported local artifact from any accepted local filesystem location
- **THEN** the system supports displaying that artifact through the Microcanvas viewer according to the defined render path, ingest path, and safety defaults for that artifact family

#### Scenario: Artifact needs an explicit rendering path
- **WHEN** a caller asks the system to show a format that is not directly displayable as-is
- **THEN** the system either transforms it through a defined supported staged path or returns a clear unsupported-content result instead of pretending success

### Requirement: Package the macOS viewer as an app bundle
The system SHALL provide a supported local build path that packages the native macOS viewer as `MicrocanvasViewer.app`.

#### Scenario: App bundle is built locally
- **WHEN** a developer runs the supported native viewer bundle build path on macOS
- **THEN** the system creates a `MicrocanvasViewer.app` bundle from the current Swift viewer source
- **AND** the bundle launches the same runtime viewer behavior as the SwiftPM viewer product

#### Scenario: Generated app bundle is kept out of source control
- **WHEN** the app bundle is produced locally
- **THEN** the generated bundle output remains ignored as build output
- **AND** source control keeps only the scripts, metadata templates, and source files required to reproduce it

### Requirement: Prefer the packaged viewer for native display
The system SHALL treat `MicrocanvasViewer.app` as the primary native macOS launch unit when showing a surface.

#### Scenario: Packaged viewer is available
- **WHEN** a caller shows a surface on macOS and the packaged viewer app is available
- **THEN** the system launches or reuses `MicrocanvasViewer.app` as the preferred native viewer
- **AND** it passes enough runtime context for the viewer to locate the active surface root

#### Scenario: Packaged viewer is unavailable
- **WHEN** a caller shows a surface on macOS and the packaged viewer app is not available
- **THEN** the system may use a development fallback launch path
- **AND** it records that the packaged app launch path was unavailable

### Requirement: Confirm native viewer mode through heartbeat
The system SHALL report native viewer mode only after confirming a fresh native viewer heartbeat for the active runtime.

#### Scenario: Fresh native heartbeat is observed
- **WHEN** the native viewer writes a fresh heartbeat for the current runtime
- **THEN** status and verification report `viewer.mode` as `native`
- **AND** they report native verification capability as available

#### Scenario: Heartbeat is missing or stale
- **WHEN** the viewer binary or app was launched but no fresh heartbeat is observed
- **THEN** the system does not report `viewer.mode` as `native`
- **AND** it explains that native heartbeat confirmation failed

#### Scenario: Heartbeat belongs to a different surface
- **WHEN** the viewer heartbeat references a different active surface than the current runtime active surface
- **THEN** the system does not treat the viewer as verified for the current surface
- **AND** it waits, retries, or reports a mismatch according to the launch mode

### Requirement: Keep the last good surface visible until newer content is ready
The system SHALL keep the last successfully presented surface visible until a newer surface is successfully promoted or no recoverable last-good surface remains.

#### Scenario: Runtime clears after a surface was already presented
- **WHEN** the viewer has already presented a surface and the runtime no longer provides an active surface
- **THEN** the viewer keeps showing the last successfully presented surface instead of blanking the canvas

#### Scenario: Updated content fails to become ready
- **WHEN** the runtime points to a newer surface but that surface fails to load or never reaches ready state
- **THEN** the viewer keeps the prior presented surface visible and does not replace it with incomplete newer content

### Requirement: Restore the last good surface after viewer relaunch
The system SHALL persist enough metadata about the last successfully presented surface to restore it after native viewer relaunch when the underlying artifact still exists.

#### Scenario: Viewer relaunches after the producer has already exited
- **WHEN** the native viewer restarts and no newer surface is ready yet
- **THEN** the viewer restores the last good surface if its artifact still exists

#### Scenario: Persisted last-good artifact is no longer available
- **WHEN** the viewer attempts to restore a persisted last-good surface whose artifact is missing
- **THEN** the viewer fails closed to its normal placeholder or error state instead of presenting misleading stale content

### Requirement: Capture snapshots from the presented surface path
The system SHALL capture native viewer snapshots from the currently presented surface path rather than from whole-window capture.

#### Scenario: Viewer snapshots a presented WKWebView surface
- **WHEN** the viewer captures a snapshot for a presented `wkwebview` surface
- **THEN** it captures from the presented web view using a supported surface snapshot path rather than deprecated whole-window capture

#### Scenario: Viewer snapshots a presented image or PDF surface
- **WHEN** the viewer captures a snapshot for a presented `image` or `pdf` surface
- **THEN** it captures from the presented surface path rather than from the enclosing app window

### Requirement: Degraded snapshots remain honest while holding prior content
The system SHALL continue to distinguish fresh captures from held last-good captures when newer content is not yet ready.

#### Scenario: Snapshot captures a held last-good surface
- **WHEN** the viewer captures a snapshot while it is intentionally holding a prior presented surface because newer content is not ready
- **THEN** the snapshot succeeds only as a degraded capture and includes warning semantics that it reflects held prior content

#### Scenario: Viewer has no current or recoverable held surface
- **WHEN** the viewer is asked to capture a snapshot and it has neither a ready current surface nor a recoverable held surface
- **THEN** the snapshot fails clearly instead of fabricating success

### Requirement: Present supported surfaces deliberately
The system SHALL present supported surfaces through a viewer experience that is deliberate and readable rather than accidental.

#### Scenario: Viewer shows a supported image surface
- **WHEN** the viewer displays a supported image surface
- **THEN** the image is centered and framed through a defined viewer presentation path instead of appearing as an awkward raw-file fallback

#### Scenario: Viewer shows a supported table surface
- **WHEN** the viewer displays a supported table surface
- **THEN** the table remains readable with defined spacing and overflow handling

### Requirement: Provide intentional empty and fallback viewer states
The system SHALL provide intentional viewer states for empty, missing, and unsupported situations.

#### Scenario: No active surface exists
- **WHEN** the viewer is open without an active surface to display
- **THEN** the viewer presents a clear no-active-surface state

#### Scenario: Active surface cannot be shown through a supported render path
- **WHEN** the viewer encounters an unsupported render mode or missing active entry artifact
- **THEN** the viewer presents a clear fallback state instead of failing silently or displaying confusing output

#### Scenario: Active surface fails while the viewer remains open
- **WHEN** the viewer encounters a load or decode failure for the active surface
- **THEN** the viewer presents a clear viewer-error state instead of leaving stale or ambiguous messaging in place

### Requirement: Keep active-surface chrome lightweight and informative
The system SHALL keep any active-surface chrome lightweight while still surfacing core metadata that improves clarity.

#### Scenario: Viewer shows an active surface
- **WHEN** the viewer displays an active supported surface
- **THEN** it may show lightweight metadata such as title, surface type, and updated timestamp without overpowering the surface body

### Requirement: Improve content readiness confidence for reload and snapshot flows
The system SHALL improve confidence that reload and snapshot flows operate on visibly ready content while preserving honest fallback behavior when readiness cannot be confirmed.

#### Scenario: Snapshot is requested after a surface update
- **WHEN** the system captures a snapshot after content has changed
- **THEN** the snapshot flow waits for the relevant content to reach a defined ready state before capturing where the viewer implementation supports that distinction

#### Scenario: Viewer reloads the active surface
- **WHEN** the active surface is replaced or updated
- **THEN** the viewer transitions to the new content through a defined reload path that avoids obviously half-loaded presentation where practical

#### Scenario: Viewer updates an active WKWebView surface
- **WHEN** an active `wkwebview` surface is replaced or refreshed
- **THEN** the viewer keeps the last ready presentation visible with lightweight updating treatment until the replacement content reaches the viewer's defined ready state

#### Scenario: Snapshot falls back to the current visible frame after readiness timeout
- **WHEN** a snapshot is requested for a `wkwebview` surface and refreshed content does not reach ready state before the viewer timeout
- **THEN** the system returns a snapshot of the currently visible frame and marks the capture as degraded with a warning that it may be stale or incomplete

#### Scenario: Snapshot fails when no visible frame exists
- **WHEN** a snapshot is requested and the viewer has no visible frame it can honestly capture
- **THEN** the snapshot flow fails clearly instead of returning a misleading success result

#### Scenario: Native viewer snapshot reflects the visible `WKWebView` presentation
- **WHEN** the native viewer reports a successful snapshot for a visible `wkwebview` surface
- **THEN** the resulting image reflects the currently visible composed frame rather than a blank, black, or incomplete capture artifact

### Requirement: Accept supported local source files through an ingest boundary
The system SHALL accept supported local source files from caller-provided filesystem locations without requiring those files to live under the Microcanvas repository root, provided the runtime can ingest them through its local source boundary.

#### Scenario: Caller shows a supported file from outside the repo root
- **WHEN** a caller asks the system to show a supported local file that lives outside the Microcanvas repo root
- **THEN** the system accepts that file as a source input if it is otherwise valid and readable
- **AND** it does not require the caller to relocate the file into the repo before use

### Requirement: Stage ingested source content before presentation
The system SHALL ingest caller-provided source content into a Microcanvas-owned staged surface directory before rendering, display, or update presentation flows.

#### Scenario: Caller renders or shows a supported external source file
- **WHEN** a caller renders or shows a supported source file
- **THEN** the system materializes a staged copy or generated artifact under the runtime-owned staging/active directories
- **AND** the viewer-facing presentation path depends on that staged content rather than on direct reads from the original source path

### Requirement: Preserve a narrow local presentation boundary for ingested sources
The system SHALL preserve the same narrow local presentation boundary for externally ingested sources as it uses for repo-local sources.

#### Scenario: Native viewer presents an externally ingested HTML-like surface
- **WHEN** the active surface originated from an external local source path
- **THEN** the native viewer still reads from the staged active-surface directory
- **AND** the original source location does not widen local read access for the viewer

### Requirement: Support explicit source-replacement updates under the ingest model
The system SHALL support refreshing the active surface from a newly provided supported source path under the ingest model.

#### Scenario: Caller updates an active surface from a new source path
- **WHEN** a caller invokes update with a supported local source path
- **THEN** the system ingests that source, refreshes the active surface through the staged surface flow, and preserves coherent active-surface identity/update behavior

### Requirement: Gate viewer-backed operations on native viewer capability
The system SHALL distinguish successful display from native viewer-backed capability for verification and snapshot flows.

#### Scenario: Update succeeds in degraded mode
- **WHEN** a caller updates the active surface and the native viewer is unavailable but an external-open fallback succeeds
- **THEN** the update succeeds for the active surface
- **AND** the resulting runtime state is marked as degraded or unverified rather than as a confirmed native viewer session

#### Scenario: Snapshot requires native viewer capability
- **WHEN** a caller requests a snapshot while the runtime is only in degraded display mode
- **THEN** the system returns a clear failure indicating that native viewer-backed snapshot capability is unavailable
- **AND** it does not claim that a snapshot was captured

#### Scenario: Verify requires native viewer-backed evidence
- **WHEN** a caller requests verify while the runtime is only in degraded display mode
- **THEN** the system does not report viewer-backed verification success
- **AND** it returns or reports that native viewer confirmation is unavailable

