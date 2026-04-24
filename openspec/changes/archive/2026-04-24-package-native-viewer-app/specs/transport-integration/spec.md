## ADDED Requirements

### Requirement: Expose packaged native viewer launch outcomes
The system SHALL return machine-friendly CLI outcomes that distinguish packaged native viewer launch success, native launch failure, and degraded fallback.

#### Scenario: Packaged native launch succeeds
- **WHEN** a caller shows a surface and the packaged native viewer launches with a fresh heartbeat
- **THEN** the CLI result identifies the viewer as native
- **AND** the result remains compatible with existing status, verify, and snapshot consumers

#### Scenario: Packaged native launch fails with fallback allowed
- **WHEN** a caller shows a surface and packaged native launch does not produce a valid heartbeat
- **AND** degraded fallback is allowed
- **THEN** the CLI may open the surface through the degraded display path
- **AND** the result includes a warning that native launch failed before fallback

#### Scenario: Packaged native launch fails with native required
- **WHEN** a caller requires native viewer mode and packaged native launch does not produce a valid heartbeat
- **THEN** the CLI returns a viewer-launch failure result
- **AND** it does not claim the surface is native verified

### Requirement: Provide native launch diagnostics
The system SHALL include enough diagnostics for callers and developers to understand why native viewer launch did not verify.

#### Scenario: Native launch does not verify
- **WHEN** native viewer launch fails to verify
- **THEN** the CLI result identifies the attempted launch method, heartbeat state, timeout or mismatch reason, and fallback decision

#### Scenario: Status is queried after native launch
- **WHEN** a caller queries status after a native launch attempt
- **THEN** status reports the best confirmed viewer mode from runtime state
- **AND** it does not infer native capability from the existence of a binary or app bundle alone
