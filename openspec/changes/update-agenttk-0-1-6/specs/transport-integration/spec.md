## MODIFIED Requirements

### Requirement: Return machine-friendly CLI outcomes
The system SHALL return AgentTK-native, machine-friendly CLI outcomes for core operational states using the supported AgentTK dependency declared by the project.

#### Scenario: CLI operation completes or fails
- **WHEN** a caller invokes a CLI operation
- **THEN** the CLI returns an AgentTK-compatible success or failure envelope
- **AND** domain-specific outcomes remain distinguishable through stable result types, warnings, verification metadata, and failure codes such as lock contention, invalid input, unsupported content, missing surface, and verification failure

#### Scenario: Degraded display is reported explicitly
- **WHEN** `show` or `update` succeeds through degraded external-open mode
- **THEN** the CLI returns success rather than pretending the operation failed
- **AND** the result explicitly reports that the runtime is unverified or degraded and that native viewer-backed flows are unavailable

#### Scenario: AgentTK dependency is refreshed
- **WHEN** the project updates the declared AgentTK dependency
- **THEN** the existing CLI contract remains compatible with the updated AgentTK runtime and type surface
- **AND** compatibility is verified through the project type checks and CLI regression tests
