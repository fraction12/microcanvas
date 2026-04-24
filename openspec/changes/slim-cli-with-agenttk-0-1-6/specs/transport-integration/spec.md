## MODIFIED Requirements

### Requirement: Return machine-friendly CLI outcomes
The system SHALL return AgentTK-native, machine-friendly CLI outcomes for core operational states using compatible AgentTK runtime helpers where they do not change the public command contract.

#### Scenario: CLI operation completes or fails
- **WHEN** a caller invokes a CLI operation
- **THEN** the CLI returns an AgentTK-compatible success or failure envelope
- **AND** domain-specific outcomes remain distinguishable through stable result types, warnings, verification metadata, and failure codes such as lock contention, invalid input, unsupported content, missing surface, and verification failure

#### Scenario: Degraded display is reported explicitly
- **WHEN** `show` or `update` succeeds through degraded external-open mode
- **THEN** the CLI returns success rather than pretending the operation failed
- **AND** the result explicitly reports that the runtime is unverified or degraded and that native viewer-backed flows are unavailable

#### Scenario: Internal helpers are updated
- **WHEN** Microcanvas adopts AgentTK helper functions for argument parsing or result construction
- **THEN** existing JSON envelopes, domain error codes, recovery metadata, and operator-facing output remain compatible with the current CLI contract
