## ADDED Requirements

### Requirement: Maintain private recent-source history
The system SHALL maintain a private local history of recently shown source files as metadata only, without storing source document contents or generated visual artifacts in the history store.

#### Scenario: Record a successful source-backed display
- **WHEN** a caller successfully shows or updates a surface from a supported local source file
- **THEN** the system records the canonical original source path and lightweight display metadata in private application-support history
- **AND** it does not store a copy of the source file or rendered artifact in the history store

#### Scenario: Keep history private from git
- **WHEN** source history is written
- **THEN** the default history location is outside the repository working tree
- **AND** the history file is not expected to be committed or pushed upstream

### Requirement: Bound and order source history
The system SHALL keep recent source history newest-first, deduped by canonical source path, and capped at 50 entries.

#### Scenario: Existing source is shown again
- **WHEN** a source path already present in history is shown again successfully
- **THEN** that source moves to the front of history
- **AND** its metadata is refreshed instead of creating a duplicate entry

#### Scenario: History exceeds the cap
- **WHEN** recording a source would make history exceed 50 entries
- **THEN** the system removes the oldest entries until only 50 remain

### Requirement: Present collapsible source history in the native viewer
The native viewer SHALL provide a collapsible side panel for recent source history while preserving the existing active-surface canvas as the primary view.

#### Scenario: User opens source history
- **WHEN** the user expands the history panel
- **THEN** the viewer lists recent source entries newest first with enough path context to distinguish them

#### Scenario: Original source is missing
- **WHEN** a recorded source path no longer exists
- **THEN** the viewer shows that history entry as unavailable
- **AND** selecting it does not attempt to reload the source

### Requirement: Reload history entries through the CLI show flow
The native viewer SHALL reload available history entries by invoking the existing CLI `show` flow rather than directly displaying original source files.

#### Scenario: User selects an available history entry
- **WHEN** the user clicks an available recent source in the viewer history panel
- **THEN** the viewer invokes the existing CLI show path for that source
- **AND** the runtime re-ingests, stages, promotes, and displays the source through the normal active-surface flow

#### Scenario: History reload fails
- **WHEN** the CLI show invocation fails for a selected history entry
- **THEN** the viewer leaves the currently presented surface visible
- **AND** it reports a concise failure state to the user
