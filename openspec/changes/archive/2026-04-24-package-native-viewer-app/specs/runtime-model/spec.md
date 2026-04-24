## ADDED Requirements

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
