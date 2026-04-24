## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Use a file-first render model
The system SHALL render canvas surfaces into deterministic local files that can be inspected and reused across invocations, even when the original source file came from outside the repository root.

#### Scenario: Render a surface to local files
- **WHEN** a caller asks the system to render a surface
- **THEN** the system writes deterministic local output for that surface under Microcanvas-owned runtime paths
- **AND** the rendered output remains usable regardless of which agent invoked the tool or where the original supported local source file lived

### Requirement: Support explicitly implemented viewable content
The system SHALL support only the viewable content formats that have an explicit implemented rendering or display path, and SHALL apply those paths consistently whether supported local source files originate inside or outside the repository root.

#### Scenario: Caller wants to show a supported artifact
- **WHEN** a caller asks the system to show a supported local artifact from any accepted local filesystem location
- **THEN** the system supports displaying that artifact through the Microcanvas viewer according to the defined render path, ingest path, and safety defaults for that artifact family

#### Scenario: Artifact needs an explicit rendering path
- **WHEN** a caller asks the system to show a format that is not directly displayable as-is
- **THEN** the system either transforms it through a defined supported staged path or returns a clear unsupported-content result instead of pretending success