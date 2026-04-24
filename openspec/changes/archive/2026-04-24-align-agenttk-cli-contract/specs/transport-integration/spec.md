## MODIFIED Requirements

### Requirement: Return machine-friendly CLI outcomes
The system SHALL return AgentTK-native, machine-friendly CLI outcomes for core operational states.

#### Scenario: CLI operation completes or fails
- **WHEN** a caller invokes a CLI operation
- **THEN** the CLI returns an AgentTK-compatible success or failure envelope
- **AND** domain-specific outcomes remain distinguishable through stable result types, warnings, verification metadata, and failure codes such as lock contention, invalid input, unsupported content, missing surface, and verification failure

#### Scenario: Degraded display is reported explicitly
- **WHEN** `show` or `update` succeeds through degraded external-open mode
- **THEN** the CLI returns success rather than pretending the operation failed
- **AND** the result explicitly reports that the runtime is unverified or degraded and that native viewer-backed flows are unavailable

### Requirement: Provide a status command for runtime inspection
The system SHALL expose runtime inspection through a dedicated status-style CLI command that reports viewer mode and verification capability.

#### Scenario: Caller checks runtime state
- **WHEN** a caller requests status
- **THEN** the CLI returns whether a native viewer is confirmed open, whether the runtime is in degraded external-open mode, whether a write lock is held, what surface is currently active, and enough manifest-derived state to identify the active entry artifact
