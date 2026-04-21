## ADDED Requirements

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

## MODIFIED Requirements

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
