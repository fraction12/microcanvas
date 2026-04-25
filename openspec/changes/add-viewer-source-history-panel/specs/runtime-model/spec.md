## MODIFIED Requirements

### Requirement: Stage ingested source content before presentation
The system SHALL ingest caller-provided source content into a Microcanvas-owned staged surface directory before rendering, display, update, or history-driven reload presentation flows.

#### Scenario: Caller renders or shows a supported external source file
- **WHEN** a caller renders or shows a supported source file
- **THEN** the system materializes a staged copy or generated artifact under the runtime-owned staging/active directories
- **AND** the viewer-facing presentation path depends on that staged content rather than on direct reads from the original source path

#### Scenario: Viewer reloads a source from history
- **WHEN** the native viewer asks to reload a source path from history
- **THEN** the runtime treats that path as a fresh source input to the normal ingest/show flow
- **AND** the viewer-facing presentation path remains the staged active-surface artifact

### Requirement: Preserve a narrow local presentation boundary for ingested sources
The system SHALL preserve the same narrow local presentation boundary for externally ingested sources and history-reloaded sources as it uses for repo-local sources.

#### Scenario: Native viewer presents a history-reloaded source
- **WHEN** a source was selected from the viewer history panel
- **THEN** the native viewer still reads from the staged active-surface directory
- **AND** the recorded original source location does not widen local read access for the viewer
