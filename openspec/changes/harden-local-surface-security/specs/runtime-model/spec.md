## ADDED Requirements

### Requirement: Treat HTML-like local surfaces as safe-by-default presentation content
The system SHALL treat Markdown-generated HTML and default raw HTML surface presentation as safe-by-default local presentation content rather than as arbitrary executable browser documents.

#### Scenario: Markdown surface contains executable browser constructs
- **WHEN** a caller renders or shows a Markdown surface whose source includes script tags, inline event handlers, or `javascript:` URLs
- **THEN** the staged HTML neutralizes or strips those executable constructs before presentation

#### Scenario: Raw HTML surface uses the default presentation path
- **WHEN** a caller renders or shows a raw `.html` or `.htm` surface through the default viewer path
- **THEN** the staged HTML neutralizes or strips executable browser constructs before presentation

### Requirement: Disable default script execution for local web surfaces in the native viewer
The system SHALL disable JavaScript execution for the default native-viewer presentation path used for local HTML-like surfaces.

#### Scenario: Native viewer opens a local HTML-like surface
- **WHEN** the native viewer presents a local `wkwebview` surface through the default runtime path
- **THEN** the web view uses a configuration that does not execute JavaScript for that surface

### Requirement: Scope local web-surface file access to staged surface content
The system SHALL scope local file access for HTML-like surfaces to the staged active-surface directory for the current surface.

#### Scenario: Native viewer opens a staged HTML-like surface
- **WHEN** the native viewer loads a staged HTML-like active surface
- **THEN** local read access is limited to that staged surface directory rather than a broader source-tree or repo-root path

### Requirement: Enforce honest non-symlinked in-root source-path guarantees
The system SHALL accept only direct in-root source paths that satisfy the runtime's stated path-safety guarantees.

#### Scenario: Caller uses a source path outside allowed roots
- **WHEN** a caller passes a source path that resolves outside the allowed roots
- **THEN** the command fails with `INVALID_INPUT`

#### Scenario: Caller uses a symlinked input file or symlinked ancestor directory
- **WHEN** a caller passes a source path that depends on a symlinked file or symlinked ancestor directory to reach the target artifact
- **THEN** the command fails with `INVALID_INPUT` rather than accepting the path through canonical resolution

## MODIFIED Requirements

### Requirement: Support explicitly implemented viewable content
The system SHALL support only the viewable content formats that have an explicit implemented rendering or display path, and SHALL apply the runtime's safety defaults to HTML-like local presentation surfaces.

#### Scenario: Caller wants to show a supported artifact
- **WHEN** a caller asks the system to show HTML, PDF, Markdown, or explicitly supported text/code artifacts
- **THEN** the system supports displaying that artifact through the Microcanvas viewer according to the defined render path and safety defaults for that artifact family

#### Scenario: HTML-like content uses the lightweight web rendering path
- **WHEN** the active surface is HTML-like content
- **THEN** the viewer opens it through the lightweight embedded web rendering path chosen for the app
- **AND** the default local presentation path applies the runtime's HTML-like safety defaults rather than behaving as an unrestricted browser surface