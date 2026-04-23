## ADDED Requirements

### Requirement: Snapshot and verify must capture the painted web surface
The system SHALL capture the rendered visual result of local web surfaces in snapshot and verify flows rather than a blank or pre-render state.

#### Scenario: Mermaid surface is visible in the live viewer
- **WHEN** a local web surface such as Mermaid renders visibly in the native viewer
- **THEN** snapshot and verify capture the painted diagram/content rather than an empty frame or raw source text

#### Scenario: Exported web snapshot preserves viewer fidelity
- **WHEN** the system exports a snapshot of a rendered local web surface
- **THEN** the exported image matches the upright painted result shown in the viewer
- **AND** it does not silently return a blank capture
