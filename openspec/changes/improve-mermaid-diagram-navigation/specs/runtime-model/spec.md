## ADDED Requirements

### Requirement: Preserve Mermaid-authored diagram styling
The system SHALL preserve user-authored Mermaid styling for rendered diagram content, including node label colors declared through Mermaid classes or theme output.

#### Scenario: Dark styled node remains readable
- **WHEN** a Mermaid source defines a node class with a dark fill and light text color
- **THEN** the rendered Mermaid surface preserves the light node text instead of overriding it with Microcanvas default dark label styling

#### Scenario: Default Mermaid styling remains readable
- **WHEN** a Mermaid source does not provide custom label colors
- **THEN** the rendered Mermaid surface uses readable default Mermaid or Microcanvas theme styling

### Requirement: Navigate large Mermaid diagrams without unreadable shrinking
The system SHALL present rendered Mermaid diagrams in a navigable viewport that preserves readable text rather than shrinking oversized diagrams until they fit the available frame.

#### Scenario: Large diagram opens with readable initial scale
- **WHEN** a Mermaid diagram is larger than the available viewer frame
- **THEN** the viewer initializes the diagram at a readable scale instead of scaling it below the configured readability floor
- **AND** the viewer allows the user to pan to off-screen diagram regions

#### Scenario: Diagram can fit while staying readable
- **WHEN** a Mermaid diagram can fit inside the available viewer frame without going below the readability floor
- **THEN** the viewer fits and centers the diagram on first presentation

#### Scenario: User controls diagram zoom
- **WHEN** a user views a rendered Mermaid diagram
- **THEN** the viewer provides explicit controls to zoom in, zoom out, fit the diagram to view, and return to 100% scale

#### Scenario: User pans across an oversized diagram
- **WHEN** a rendered Mermaid diagram extends beyond the visible viewport
- **THEN** the viewer allows the user to navigate across the diagram without requiring the diagram text to become smaller

### Requirement: Keep Mermaid snapshot behavior compatible with navigable presentation
The system SHALL keep Mermaid snapshot and export behavior compatible with the navigable diagram presentation.

#### Scenario: Snapshot captures rendered Mermaid output
- **WHEN** a rendered Mermaid surface uses the navigable diagram viewport
- **THEN** snapshot capture still waits for the Mermaid SVG to render and captures visible diagram output instead of a blank frame

#### Scenario: Default snapshot remains deterministic
- **WHEN** a user captures a snapshot of a rendered Mermaid surface
- **THEN** the default snapshot represents the rendered diagram output independently of transient live pan or zoom state
