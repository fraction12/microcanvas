# transport-integration Specification

## Purpose
TBD - created by archiving change bootstrap-microcanvas. Update Purpose after archive.
## Requirements
### Requirement: Preserve one shared surface model across callers
The system SHALL preserve the same render/session model regardless of which agent or tool invoked it.

#### Scenario: Reuse a rendered surface across callers
- **WHEN** a rendered surface is shown first through one caller and later through another
- **THEN** the same underlying rendered output and session state remain usable without redefining the surface format

### Requirement: Use strict safe surface resolution
The system SHALL reject unsafe surface resolution patterns such as path traversal or symlink-based escape from the allowed surface root.

#### Scenario: Caller requests an unsafe path
- **WHEN** a caller tries to resolve a surface path that escapes the configured surface root
- **THEN** the system rejects the request instead of serving or displaying ambiguous filesystem content

### Requirement: Keep caller handling tool-agnostic
The system SHALL treat caller identity as irrelevant to the core rendering and viewing contract.

#### Scenario: Different agents invoke the same operation
- **WHEN** different agents ask the system to render or show equivalent surfaces
- **THEN** the system applies the same core behavior instead of branching into agent-specific runtime paths

### Requirement: Keep the runtime portable even if the first viewer is macOS-first
The system SHALL keep the CLI and surface model portable even if the first viewer implementation is macOS-native.

#### Scenario: Viewer implementation is platform-specific but the tool contract is not
- **WHEN** the first viewer ships as a macOS-first implementation
- **THEN** the CLI and surface model remain cleanly separable from that platform choice so later viewers can reuse the same runtime contract

### Requirement: Expose lock contention clearly through the CLI
The system SHALL expose active write-lock contention clearly through its CLI contract.

#### Scenario: CLI caller hits an active write lock
- **WHEN** a CLI caller requests a mutating operation while another caller holds the write lock
- **THEN** the CLI returns a clear try-again-later style result instead of hanging silently or corrupting state

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

### Requirement: Distinguish mutating and non-mutating commands
The system SHALL define which CLI commands mutate runtime state and therefore require the write lock.

#### Scenario: Non-mutating command runs during idle state
- **WHEN** a caller invokes a non-mutating command such as status
- **THEN** the command completes without unnecessarily taking the write lock

#### Scenario: Mutating command updates filesystem-backed runtime state
- **WHEN** a caller invokes a mutating command such as render, show, or update
- **THEN** the command respects the write lock and updates the canonical surface-root state through the defined runtime model

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

### Requirement: Publish only the current CLI contract artifacts
The system SHALL ensure packaged CLI artifacts align with the current source-owned command and result contract.

#### Scenario: Packaged CLI output is checked
- **WHEN** the project prepares or dry-runs the npm package
- **THEN** the packaged CLI output includes only files generated from the current tracked CLI, core, and viewer source
- **AND** it excludes stale generated contract files that are no longer produced from source

#### Scenario: Removed internal contract artifact lingers
- **WHEN** a prior internal CLI/result artifact no longer has a source file or supported import path
- **THEN** that artifact is removed from generated output before package publication

