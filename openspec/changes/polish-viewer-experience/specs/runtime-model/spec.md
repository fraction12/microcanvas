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
