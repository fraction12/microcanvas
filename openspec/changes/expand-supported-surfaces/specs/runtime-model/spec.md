## ADDED Requirements

### Requirement: Support explicit surface families through implemented paths
The system SHALL expand supported surfaces only through explicit implemented rendering or display paths.

#### Scenario: Supported family is added
- **WHEN** a new surface family is introduced
- **THEN** the system defines its detection, render/materialization path, manifest metadata, and viewer mode explicitly

#### Scenario: Unsupported family remains unsupported
- **WHEN** a caller provides a file type without an implemented path
- **THEN** the system returns `UNSUPPORTED_CONTENT`
- **AND** it does not claim the surface was rendered or shown successfully

### Requirement: Support image surfaces
The system SHALL support first-class image surfaces.

#### Scenario: Caller shows a supported image
- **WHEN** a caller shows a supported image file
- **THEN** the system materializes an image surface and displays it through the viewer using a defined image display path

### Requirement: Support table/data surfaces through deterministic transforms
The system SHALL support table/data surfaces through explicit deterministic rendering.

#### Scenario: Caller shows CSV data
- **WHEN** a caller shows a CSV file
- **THEN** the system transforms it into a deterministic HTML table surface for display

### Requirement: Support structured text surfaces through explicit wrapped rendering
The system SHALL support structured text surfaces through explicit wrapped rendering paths.

#### Scenario: Caller shows structured text
- **WHEN** a caller shows YAML, TOML, XML, or log content
- **THEN** the system renders it through a defined wrapped text/code surface path

### Requirement: Use an internal adapter direction for surface families
The system SHALL organize supported surface families through an internal adapter-like structure or equivalent registry.

#### Scenario: New supported family is added
- **WHEN** the runtime expands supported surfaces
- **THEN** the implementation adds a defined matching/materialization path for that family instead of relying on an ever-growing unstructured branch chain
