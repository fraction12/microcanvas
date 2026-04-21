## ADDED Requirements

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

### Requirement: Improve content readiness confidence for reload and snapshot flows
The system SHALL improve confidence that reload and snapshot flows operate on visibly ready content.

#### Scenario: Snapshot is requested after a surface update
- **WHEN** the system captures a snapshot after content has changed
- **THEN** the snapshot flow waits for the relevant content to reach a defined ready state before capturing where the viewer implementation supports that distinction

#### Scenario: Viewer reloads the active surface
- **WHEN** the active surface is replaced or updated
- **THEN** the viewer transitions to the new content through a defined reload path that avoids obviously half-loaded presentation where practical
