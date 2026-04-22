## Design

Microcanvas should be hardened around its real trust boundary, not dressed up with security theatre.

The product is a local presentation runtime for trusted artifacts. It is not a browser and should not pretend to safely execute arbitrary hostile content. The hardening pass should therefore make the default path safer, narrower, and more honest without bloating the runtime.

### Design principles

1. **Safe-by-default for HTML-like surfaces**
   - Markdown and raw HTML surfaces should not execute arbitrary script by default.
   - If full raw-HTML behavior is ever needed later, it must be explicit and clearly unsafe.

2. **Stage then present**
   - The viewer should read from staged/active surface artifacts, not from broad source-tree locations.
   - Any local file access granted to web content should be scoped to the staged surface directory.

3. **Trust boundary honesty**
   - The system should claim safety for trusted local artifacts, not for arbitrary hostile files.
   - Unsupported or unsafe behavior should be described plainly.

4. **Deterministic hardening**
   - Hardening should preserve deterministic render/show/update behavior and testability.
   - Avoid policy that depends on network access, online lookups, or opaque runtime heuristics.

### Wedge A: Harden HTML-like surfaces

#### Markdown
Markdown currently becomes HTML for presentation. That path should be sanitized before it becomes a staged `index.html` surface.

The default Markdown rendering path should neutralize or strip:
- `<script>` and other executable elements
- inline event handlers such as `onload` / `onerror`
- `javascript:` URLs
- embed-style tags that introduce browser-like execution or remote loading risk unless explicitly allowed later

#### Raw HTML
Raw `.html` / `.htm` inputs should no longer be treated as a trusted browser document by default. The hardened default should sanitize them before staging so the resulting active artifact fits the same local presentation posture as generated Markdown HTML.

If a future use case genuinely requires fully unsanitized raw HTML, that should be introduced only as an explicit unsafe mode with matching documentation and warnings. It is not part of this pass.

#### Viewer runtime
For `WKWebView` surfaces, the native viewer should use an explicit `WKWebViewConfiguration` with JavaScript disabled for the default local-surface presentation path.

This creates defense in depth:
- staged HTML is sanitized before presentation
- the viewer does not rely solely on sanitization

### Wedge B: Narrow local file access

`WKWebView.loadFileURL(...allowingReadAccessTo:)` should grant access only to the staged active-surface directory for the current surface.

This means:
- HTML-like surfaces may load their staged sibling assets when intentionally materialized there
- the active web view should not implicitly gain broader repo-root or source-root read access

Any asset flow needed by generated surfaces should therefore be copied or materialized into the staged directory rather than read lazily from arbitrary source locations.

### Wedge C: Tighten path validation and symlink handling

The current path-validation story should be made stricter and more explicit.

The hardened behavior should reject:
- source files outside allowed roots
- symlinked input files
- inputs reached through symlinked ancestor directories when that would bypass the stated path guarantees
- traversal attempts that escape the allowed roots

The implementation may still use canonical path resolution internally, but the observable guarantee should match the product claim: only direct, in-root, non-symlinked source paths are accepted for normal surface materialization.

### Wedge D: Documentation and posture

The README and security documentation should describe Microcanvas as:
- safe by default for trusted local artifacts
- intentionally narrow in supported content behavior
- not a browser sandbox for arbitrary hostile third-party content

This is not mere copy cleanup. It is part of the product contract.

### Test strategy

Add regression tests in two layers.

#### Runtime/rendering tests
- markdown fixture with script tags, inline handlers, `javascript:` links, and embed-style elements
- raw HTML fixture with the same patterns
- assertions that the staged active HTML strips or neutralizes unsafe constructs

#### Path-safety tests
- symlinked file inside repo
- symlinked directory containing an otherwise valid file
- direct outside-root file
- relative traversal attempts that resolve outside root

#### Viewer/configuration tests
- verify that the web-view creation path uses explicit configuration with JavaScript disabled
- preserve current show/update/verify/snapshot expectations for safe surfaces

### Implementation notes

A small sanitizer dependency is acceptable if it is narrow, maintained, and deterministic. If no suitable lightweight option fits, a tightly scoped internal sanitization layer is acceptable for the limited allowed content profile, but it must be covered by regression tests. The goal is not maximal HTML fidelity; the goal is safe local presentation defaults.

### Rollout recommendation

Implement this as one dedicated hardening PR:
1. sanitize HTML-like surfaces
2. disable JS in the viewer
3. narrow local file-read scope
4. tighten symlink/path checks
5. add regression tests and docs

That keeps the review focused on real risk rather than mixing it with unrelated feature work.