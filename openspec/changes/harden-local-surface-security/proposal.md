## Why

Microcanvas is now credible enough that people will reasonably ask whether it is safe to use, not just whether it works.

The main security risk in the current shape is HTML-like content. Markdown is rendered into HTML, raw HTML can be shown directly, and the native viewer uses `WKWebView` for those surfaces. That is fine for trusted local artifacts, but it is too permissive for a product that should be safe by default. The runtime also makes stronger path-safety claims than it currently enforces around symlinked inputs and local file access boundaries.

This change hardens the runtime around the real trust boundary: local surface presentation. It should reduce obvious script/content risks, narrow file-read scope, and make the product honest about what it does and does not secure.

## What changes

This change hardens local surface handling in four tight areas:

1. Make HTML-like surfaces safe by default.
2. Narrow the viewer's local file access to staged surface directories.
3. Tighten path validation so symlink and traversal behavior matches the stated guarantees.
4. Document the security posture clearly: trusted local artifacts by default, not a general-purpose browser sandbox.

## Non-goals

- No network sandboxing or browser-grade site isolation.
- No claim that Microcanvas safely renders arbitrary hostile third-party content.
- No office-document or archive hardening in this pass.
- No major viewer UX redesign outside what is required for the safer defaults.
- No broad permission model or multi-user security model.

## Success criteria

- Rendered Markdown and raw HTML surfaces no longer execute arbitrary script by default in the native viewer.
- Local web-surface file access is scoped to the staged active-surface directory rather than a broader repo path.
- Path validation rejects symlinked or escaping inputs in a way that matches the product's stated guarantees.
- The README and security docs describe the system as safe for trusted local artifacts, not as a hostile-content sandbox.
- Regression tests cover hostile HTML/Markdown content, path escapes, and symlinked inputs.