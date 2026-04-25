## MODIFIED Requirements

### Requirement: Preserve one shared surface model across callers
The system SHALL preserve the same render/session model regardless of which agent, tool, or native viewer action invoked it.

#### Scenario: Reuse a rendered surface across callers
- **WHEN** a rendered surface is shown first through one caller and later through another
- **THEN** the same underlying rendered output and session state remain usable without redefining the surface format

#### Scenario: Native viewer reloads from source history
- **WHEN** the native viewer reloads an available history entry
- **THEN** it invokes the same CLI show behavior used by command-line callers
- **AND** it does not introduce a separate native rendering path
