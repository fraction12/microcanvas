## MODIFIED Requirements

### Requirement: Return machine-friendly CLI outcomes
The system SHALL return AgentTK-native, machine-friendly CLI outcomes for core operational states while explicitly defining which CLI runtime and presentation responsibilities are delegated to AgentTK.

#### Scenario: CLI operation completes or fails
- **WHEN** a caller invokes a CLI operation
- **THEN** the CLI returns an AgentTK-compatible success or failure envelope
- **AND** domain-specific outcomes remain distinguishable through stable result types, warnings, verification metadata, and failure codes such as lock contention, invalid input, unsupported content, missing surface, and verification failure

#### Scenario: Degraded display is reported explicitly
- **WHEN** `show` or `update` succeeds through degraded external-open mode
- **THEN** the CLI returns success rather than pretending the operation failed
- **AND** the result explicitly reports that the runtime is unverified or degraded and that native viewer-backed flows are unavailable

#### Scenario: Runtime dispatch is delegated
- **WHEN** Microcanvas delegates command dispatch, help handling, or result emission to AgentTK runtime helpers
- **THEN** JSON command output remains compatible with documented Microcanvas result envelopes unless a breaking change is explicitly accepted
- **AND** unknown-command behavior is defined and covered by regression tests

#### Scenario: Human presentation changes
- **WHEN** Microcanvas replaces custom human output with AgentTK presentation hooks or defaults
- **THEN** the accepted operator-facing output shape is documented and covered by presentation regression tests
