## Why

Microcanvas now has a real native viewer, viewer-backed verification, real PNG snapshots, lock discipline, and a cleaner CLI. The next bottleneck is surface coverage.

Right now the tool is honest but narrow: HTML, Markdown, PDF, and selected text/code files wrapped into HTML. That is the right starting point, but it leaves obvious high-value artifacts unsupported.

The next expansion should increase useful surface coverage without collapsing back into vague “anything viewable” claims. The system should only support formats that have explicit implemented rendering/display paths.

## What changes

This change expands supported surfaces in staged wedges:

1. Add image surfaces as first-class supported content.
2. Add CSV/tabular surfaces through a generated HTML table path.
3. Add structured text surfaces such as YAML, TOML, XML, and logs through the existing explicit HTML-wrapped rendering path.
4. Refactor content detection into an internal adapter registry so future expansion stays clean.

## Non-goals

- No magical catch-all artifact support.
- No office document support in this pass.
- No archive/binary interpretation.
- No multi-surface workspace semantics.
- No change to the single-active-surface v1 runtime model.

## Success criteria

- Supported surface families are explicit and documented.
- Unsupported files still fail honestly with `UNSUPPORTED_CONTENT`.
- The viewer has a defined display mode per supported surface family.
- New surface support lands through adapter-style internal structure rather than one giant extension switch forever.
