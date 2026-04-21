## 1. Surface expansion roadmap

- [ ] 1.1 Define explicit supported surface families and support tiers.
- [ ] 1.2 Keep unsupported formats on an honest `UNSUPPORTED_CONTENT` path.
- [ ] 1.3 Document the staged rollout order for new surface families.

## 2. Image surfaces

- [ ] 2.1 Add first-class image surface support.
- [ ] 2.2 Define viewer display behavior for image surfaces.
- [ ] 2.3 Add tests for image render/show behavior.
- [ ] 2.4 Document image support in the README and spec artifacts.

## 3. Table / data surfaces

- [ ] 3.1 Add CSV support through deterministic HTML table rendering.
- [ ] 3.2 Define manifest/renderMode behavior for table surfaces.
- [ ] 3.3 Add tests for CSV render/show behavior.
- [ ] 3.4 Document CSV/table support clearly.

## 4. Structured text surfaces

- [ ] 4.1 Add YAML/TOML/XML/log support through explicit wrapped rendering paths.
- [ ] 4.2 Reuse and clean up the text/code rendering family.
- [ ] 4.3 Add tests for structured-text surface behavior.
- [ ] 4.4 Document structured-text support clearly.

## 5. Internal structure

- [ ] 5.1 Refactor inline content detection toward an adapter registry or equivalent structure.
- [ ] 5.2 Ensure new surface families plug into the same manifest/viewer contract.
- [ ] 5.3 Keep the architecture lightweight and deterministic.

## 6. Validation

- [ ] 6.1 Validate the OpenSpec change.
- [ ] 6.2 Keep the proposal aligned with actual implemented display paths.
