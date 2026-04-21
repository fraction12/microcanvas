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
The system SHALL return stable, machine-friendly CLI outcomes for core operational states.

#### Scenario: CLI operation completes or fails
- **WHEN** a caller invokes a CLI operation
- **THEN** the CLI returns a stable result shape that clearly distinguishes success, lock contention, invalid input, unsupported content, and viewer-launch failure

### Requirement: Provide a status command for runtime inspection
The system SHALL expose runtime inspection through a dedicated status-style CLI command.

#### Scenario: Caller checks runtime state
- **WHEN** a caller requests status
- **THEN** the CLI returns whether the viewer is open, whether a write lock is held, what surface is currently active, and enough manifest-derived state to identify the active entry artifact

### Requirement: Distinguish mutating and non-mutating commands
The system SHALL define which CLI commands mutate runtime state and therefore require the write lock.

#### Scenario: Non-mutating command runs during idle state
- **WHEN** a caller invokes a non-mutating command such as status
- **THEN** the command completes without unnecessarily taking the write lock

#### Scenario: Mutating command updates filesystem-backed runtime state
- **WHEN** a caller invokes a mutating command such as render, show, or update
- **THEN** the command respects the write lock and updates the canonical surface-root state through the defined runtime model

