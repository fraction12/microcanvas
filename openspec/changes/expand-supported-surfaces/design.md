## Design

Microcanvas should expand supported surfaces through explicit, adapter-like rendering/display paths, not by accreting a shapeless list of file extensions.

### Design principles

1. **Implemented paths only**
   - A surface is supported only when the runtime and viewer have a concrete path for it.
   - Unsupported formats must continue to return `UNSUPPORTED_CONTENT`.

2. **Transform before native support when practical**
   - If a format can be made useful through deterministic HTML generation, prefer that before inventing native viewer complexity.
   - Native support is appropriate when HTML wrapping would be clumsy or lossy.

3. **Surface families, not one-off hacks**
   - Add support in coherent families: images, tabular data, structured text.
   - Each family should define detection, render output, manifest shape, viewer mode, verify expectations, and snapshot behavior.

4. **Adapter registry direction**
   - Replace inline file-type branching with an internal registry or equivalent adapter model.
   - Each adapter should answer:
     - does this source match?
     - how is it rendered/materialized?
     - what manifest/renderMode does it produce?
     - what viewer path does it expect?

### Planned wedges

#### Wedge 1: Image surfaces

Add first-class support for:
- png
- jpg/jpeg
- webp
- gif
- svg (if it cleanly fits either image or HTML/web path)

Expected shape:
- detect image MIME/extension explicitly
- manifest render mode for image display
- native viewer image path or lightweight web rendering path where appropriate
- viewer-backed snapshot should continue to work without special casing

#### Wedge 2: CSV / tabular surfaces

Add CSV support through deterministic HTML table rendering.

Expected shape:
- source remains CSV
- rendered artifact becomes HTML table view
- manifest marks generated HTML display path
- initial version prioritizes readability over spreadsheet-like interactivity

#### Wedge 3: Structured text surfaces

Add explicit support for:
- yaml/yml
- toml
- xml
- log

Expected shape:
- reuse the code/text rendering family
- provide sensible labeling and content-type metadata
- keep output deterministic and lightweight

#### Wedge 4: Adapter registry refactor

Introduce an internal content adapter structure so new surface families stop bloating one detection function.

A minimal direction is:
- adapter id
- match(sourcePath)
- materialize(sourcePath, title, surfaceId)
- output metadata (contentType, sourceKind, renderMode)

### Support tiers

#### Tier A: First-class
- html/htm
- markdown
- pdf
- images

#### Tier B: Transformed
- txt/json/js/ts
- csv
- yaml/toml/xml/log

#### Tier C: Unsupported in this pass
- zip and arbitrary archives
- office docs
- arbitrary binaries
- media types without a defined path

### Verification expectations

Each new surface family should add:
- detection tests
- render/show tests
- viewer-mode/manifest assertions
- unsupported-content regression checks for nearby unsupported types
