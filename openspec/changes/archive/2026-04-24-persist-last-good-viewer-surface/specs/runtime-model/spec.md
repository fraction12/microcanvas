## ADDED Requirements

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
