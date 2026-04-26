## ADDED Requirements

### Requirement: Present generated surfaces with a neutral workbench theme
The system SHALL present Microcanvas-generated web surfaces with a neutral workbench theme that uses shared presentation tokens for equivalent visual roles and avoids dominant beige, tan, orange, or teal default palettes.

#### Scenario: Markdown and text-like surfaces use neutral generated chrome
- **WHEN** the system renders a Markdown or text-like source through the generated HTML path
- **THEN** the generated page, card, text, links, code blocks, and borders use the shared neutral workbench tokens
- **AND** the generated chrome does not use beige, tan, orange, or teal as dominant background, border, or accent colors

#### Scenario: CSV surface uses neutral generated chrome
- **WHEN** the system renders a CSV source through the generated table path
- **THEN** the table frame, header cells, body cells, borders, and empty state use the shared neutral workbench tokens
- **AND** the table remains readable with sufficient contrast

#### Scenario: Mermaid shell uses neutral generated chrome
- **WHEN** the system renders a Mermaid source through the generated HTML path
- **THEN** the Mermaid header, toolbar, viewport, source panel, borders, and error state use the shared neutral workbench tokens
- **AND** the Mermaid diagram content remains visually distinct from the surrounding Microcanvas chrome

#### Scenario: Generated surface colors are centralized
- **WHEN** a developer updates generated surface colors
- **THEN** Markdown, text-like, CSV, and Mermaid generated surfaces share named theme tokens rather than unrelated hard-coded palettes for the same semantic roles

#### Scenario: Neutral theme uses defined visual roles
- **WHEN** generated surface CSS defines the Microcanvas theme
- **THEN** it defines named roles for at least page background, primary canvas, raised surface, primary text, muted text, border, soft border, accent, and soft accent
- **AND** format-specific CSS consumes those roles instead of inventing unrelated default colors for the same roles

#### Scenario: Old palette is absent from Microcanvas-owned defaults
- **WHEN** a supported generated web surface is rendered
- **THEN** Microcanvas-owned default CSS does not include the old dominant beige, tan, orange, or teal palette for surface backgrounds, accent strips, table chrome, Mermaid viewport chrome, or source panels
- **AND** any occurrence of those colors is limited to user-authored source content or an explicitly documented semantic state such as an error

### Requirement: Preserve source-authored visual semantics
The system SHALL keep source-authored visual semantics intact while applying Microcanvas chrome around supported surfaces.

#### Scenario: User HTML keeps source styling
- **WHEN** the system presents a supported raw HTML source
- **THEN** the system does not wrap it in the generated neutral theme or recolor its authored content

#### Scenario: Image content is not recolored
- **WHEN** the viewer presents an image surface
- **THEN** Microcanvas may use neutral viewer chrome around the surface
- **AND** it does not recolor, tint, filter, or otherwise alter the image pixels

#### Scenario: PDF content is not recolored
- **WHEN** the viewer presents a PDF surface
- **THEN** Microcanvas may use neutral viewer chrome around the PDF view
- **AND** it does not recolor, tint, filter, or otherwise alter the PDF page content

#### Scenario: Mermaid custom colors win
- **WHEN** a Mermaid source defines explicit node, edge, label, or class colors
- **THEN** the rendered diagram preserves those source-authored colors over Microcanvas defaults

#### Scenario: Microcanvas defaults only fill unspecified Mermaid roles
- **WHEN** a Mermaid source does not specify colors for a diagram role
- **THEN** Microcanvas may provide neutral readable Mermaid defaults for that unspecified role
- **AND** those defaults do not override explicitly styled Mermaid classes, nodes, edges, or labels

#### Scenario: Source panel preserves source text
- **WHEN** a generated surface exposes its underlying source text
- **THEN** the source panel displays the source faithfully with syntax/content unchanged
- **AND** presentation styling does not mutate the stored or embedded source content

### Requirement: Keep Mermaid styled labels readable
The system SHALL render Mermaid styled nodes with readable labels in both live viewer and snapshot output, including dark nodes with light source-authored text.

#### Scenario: Dark Mermaid node uses light label text
- **WHEN** a Mermaid source defines a dark node fill and light text color
- **THEN** the rendered diagram displays the node label with the light text color
- **AND** the label is readable against the node fill in the live viewer

#### Scenario: Styled Mermaid labels remain readable in snapshots
- **WHEN** a snapshot is captured for a Mermaid diagram containing dark styled nodes with light source-authored text
- **THEN** the snapshot output preserves readable light labels on those dark nodes
- **AND** snapshot capture does not fall back to a black-on-black or blank diagram artifact

#### Scenario: Mermaid label strategy is regression tested
- **WHEN** the Mermaid renderer configuration changes, including `htmlLabels` or an equivalent label-rendering strategy
- **THEN** regression coverage verifies default Mermaid diagrams remain readable
- **AND** regression coverage verifies custom styled-node diagrams preserve source-authored label colors

#### Scenario: Local architecture diagram remains readable
- **WHEN** the Local Computer Operator Model Architecture Mermaid fixture is rendered
- **THEN** its dark styled nodes do not display black-on-black labels

#### Scenario: Mermaid navigation still works after label strategy changes
- **WHEN** the Mermaid label strategy is changed to preserve styled-label readability
- **THEN** the existing Mermaid pan, zoom, fit, and 100% controls continue to operate on the rendered diagram
- **AND** the rendered SVG remains discoverable to the native snapshot path

### Requirement: Align native surface chrome with generated surface theme
The system SHALL align native image, PDF, and fallback surface chrome with the neutral workbench direction while preserving source content and platform-appropriate behavior.

#### Scenario: Image surface uses neutral viewer chrome
- **WHEN** the native viewer displays an image surface
- **THEN** the surrounding background, frame, border, and shadow use neutral workbench styling
- **AND** the image pixels are not altered

#### Scenario: PDF surface uses neutral viewer chrome
- **WHEN** the native viewer displays a PDF surface
- **THEN** the surrounding viewer background uses neutral workbench styling where the platform surface allows it
- **AND** the PDF content is not altered

#### Scenario: Fallback states use neutral viewer chrome
- **WHEN** the native viewer presents an empty, missing, unsupported, or decode-failure state
- **THEN** the fallback state uses the same neutral workbench visual direction as supported surfaces

#### Scenario: Native chrome stays visually consistent with generated chrome
- **WHEN** a user switches between generated web surfaces and native image, PDF, or fallback surfaces
- **THEN** Microcanvas-owned background, frame, border, and muted text treatment appears part of the same neutral workbench system
- **AND** differences caused by native platform controls are limited to platform-appropriate rendering details

### Requirement: Verify themed surfaces through representative fixtures
The system SHALL verify the neutral theme and Mermaid readability with representative fixtures instead of relying only on implementation-specific string checks.

#### Scenario: Representative generated surfaces are covered
- **WHEN** regression tests exercise generated surface rendering
- **THEN** they cover at least one Markdown or text-like source, one CSV source, one default Mermaid source, and one custom styled Mermaid source

#### Scenario: Real-world Mermaid architecture fixture is covered
- **WHEN** regression tests exercise Mermaid styled-label readability
- **THEN** they include a fixture equivalent to the Local Computer Operator Model Architecture diagram with dark styled node classes and light label text

#### Scenario: Theme guardrails are covered
- **WHEN** regression tests inspect generated Microcanvas-owned CSS
- **THEN** they verify shared neutral theme tokens are present
- **AND** they verify the prior dominant beige, tan, orange, and teal defaults are absent from Microcanvas-owned generated chrome

#### Scenario: Visual verification is available for theme changes
- **WHEN** the neutral theme implementation is completed
- **THEN** there is a practical verification path that renders representative surfaces for human inspection in the Microcanvas viewer
- **AND** any unverified visual assumptions are called out before the change is archived
