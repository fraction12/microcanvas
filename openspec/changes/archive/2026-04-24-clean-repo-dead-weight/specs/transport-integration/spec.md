## ADDED Requirements

### Requirement: Publish only the current CLI contract artifacts
The system SHALL ensure packaged CLI artifacts align with the current source-owned command and result contract.

#### Scenario: Packaged CLI output is checked
- **WHEN** the project prepares or dry-runs the npm package
- **THEN** the packaged CLI output includes only files generated from the current tracked CLI, core, and viewer source
- **AND** it excludes stale generated contract files that are no longer produced from source

#### Scenario: Removed internal contract artifact lingers
- **WHEN** a prior internal CLI/result artifact no longer has a source file or supported import path
- **THEN** that artifact is removed from generated output before package publication
