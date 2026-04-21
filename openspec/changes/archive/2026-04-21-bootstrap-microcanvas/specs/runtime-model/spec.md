## ADDED Requirements

### Requirement: Cover the core canvas runtime job
The system SHALL support the core canvas runtime flows of rendering, showing, updating, snapshotting, and verifying lightweight visual surfaces.

#### Scenario: Drive a surface through the main lifecycle
- **WHEN** a caller uses the system to work with a canvas surface
- **THEN** the system supports render, show, update, snapshot, and verify flows for that surface

### Requirement: Provide a primary standalone app viewer
The system SHALL provide its own simple app viewer so that rendered surfaces can be shown without depending on a background server or any specific calling agent.

#### Scenario: Show a surface through the Microcanvas viewer
- **WHEN** a caller asks the system to show a rendered surface
- **THEN** the system opens and displays that surface through the Microcanvas viewer

#### Scenario: Reuse the same viewer window
- **WHEN** the viewer is already open and a caller asks to show a new surface
- **THEN** the system reuses the same viewer window for the new active surface instead of spawning an uncontrolled number of windows by default

### Requirement: Use a lightweight native viewer implementation for v1
The system SHALL prefer a lightweight native macOS viewer implementation for v1 over a heavy cross-platform app shell.

#### Scenario: Viewer implementation is chosen for v1
- **WHEN** the first viewer is implemented
- **THEN** it uses a lightweight native macOS path rather than introducing Electron-class overhead for the initial version

### Requirement: Use a file-first render model
The system SHALL render canvas surfaces into deterministic local files that can be inspected and reused across invocations.

#### Scenario: Render a surface to local files
- **WHEN** a caller asks the system to render a surface
- **THEN** the system writes deterministic local output for that surface
- **AND** the rendered output remains usable regardless of which agent invoked the tool

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
The system SHALL support only the viewable content formats that have an explicit implemented rendering or display path.

#### Scenario: Caller wants to show a supported artifact
- **WHEN** a caller asks the system to show HTML, PDF, Markdown, or explicitly supported text/code artifacts
- **THEN** the system supports displaying that artifact through the Microcanvas viewer

#### Scenario: Artifact needs an explicit rendering path
- **WHEN** a caller asks the system to show a format that is not directly displayable as-is
- **THEN** the system either transforms it through a defined supported path or returns a clear unsupported-content result instead of pretending success

#### Scenario: Unsupported artifact is rejected honestly
- **WHEN** a caller asks the system to show an artifact with no implemented rendering or display path
- **THEN** the system returns an `UNSUPPORTED_CONTENT` result
- **AND** it does not claim the surface was shown successfully

#### Scenario: Manifest records how the viewer should open content
- **WHEN** the system materializes a supported artifact for display
- **THEN** the active surface metadata records the relevant entry path and render mode for that artifact

#### Scenario: HTML-like content uses the lightweight web rendering path
- **WHEN** the active surface is HTML-like content
- **THEN** the viewer opens it through the lightweight embedded web rendering path chosen for the app

#### Scenario: PDF uses a supported lightweight display path
- **WHEN** the active surface is a PDF artifact
- **THEN** the viewer opens it through a supported lightweight display path rather than forcing an unrelated rendering pipeline
