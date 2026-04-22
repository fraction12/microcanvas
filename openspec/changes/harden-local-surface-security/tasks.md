## 1. HTML-like surface hardening

- [ ] 1.1 Define the default safe-content policy for Markdown and raw HTML surfaces.
- [ ] 1.2 Sanitize rendered Markdown HTML before staging it as an active surface.
- [ ] 1.3 Sanitize raw `.html` / `.htm` inputs before staging them for the default viewer path.
- [ ] 1.4 Reject or neutralize executable constructs such as script tags, inline event handlers, and `javascript:` URLs.
- [ ] 1.5 Preserve deterministic rendering behavior for safe HTML-like surfaces.

## 2. Native viewer hardening

- [ ] 2.1 Create `WKWebView` instances with an explicit configuration for hardened local-surface presentation.
- [ ] 2.2 Disable JavaScript for the default `WKWebView` surface path.
- [ ] 2.3 Confirm existing web-surface loading, update, and snapshot flows still behave correctly under the hardened configuration.

## 3. Local file access scoping

- [ ] 3.1 Limit `WKWebView` local read access to the staged active-surface directory.
- [ ] 3.2 Ensure generated or copied web surfaces only depend on assets intentionally present in that staged directory.
- [ ] 3.3 Add regression coverage for staged web surfaces under the narrower local-read scope.

## 4. Path and symlink safety

- [ ] 4.1 Tighten input validation so accepted source paths match the stated in-root guarantee.
- [ ] 4.2 Reject symlinked input files and symlinked ancestor-directory paths that would bypass the normal root restriction.
- [ ] 4.3 Keep escaping/out-of-root paths on a clear `INVALID_INPUT` path.
- [ ] 4.4 Add tests for symlinked files, symlinked directories, and outside-root traversal attempts.

## 5. Documentation and posture

- [ ] 5.1 Update README wording to describe the trusted-local-artifact security posture honestly.
- [ ] 5.2 Add or update security guidance for HTML-like surfaces and unsafe-content expectations.
- [ ] 5.3 Document that Microcanvas is not a hostile-content browser sandbox.

## 6. Validation

- [ ] 6.1 Add regression fixtures for hostile Markdown and hostile raw HTML inputs.
- [ ] 6.2 Run `npm test` and keep the hardened path green.
- [ ] 6.3 Validate the OpenSpec change.