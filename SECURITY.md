# Security Policy

Thanks for helping keep Microcanvas safe.

## Reporting A Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Instead, report the issue privately to the project maintainer with:

- a description of the issue
- steps to reproduce it
- the impact you believe it has
- any suggested fix or mitigation, if you have one

If you already know the preferred private contact route for this project, use that channel. If not, open a minimal public issue asking for a private security contact path without including exploit details.

## What To Expect

The project will aim to:

- acknowledge receipt
- assess the report
- determine a fix or mitigation path
- coordinate disclosure when appropriate

Because Microcanvas is early-stage, response times may vary, but good-faith reports are appreciated.

## Security Scope

Areas of particular interest include:

- path traversal, symlink-resolution bypasses, or other filesystem escape bugs
- lock handling or state corruption issues
- unsafe rendering or file handling behavior
- viewer or snapshot flows that expose data unexpectedly

## Current Security Posture

Microcanvas now hardens the default local surface path in a few specific ways:

- Markdown-rendered HTML, raw HTML, and wrapped code/text surfaces are sanitized before staging
- the default macOS `WKWebView` presentation path disables JavaScript
- local read access for web surfaces is scoped to the current staged active-surface directory
- normal source materialization rejects symlinked source paths and symlinked ancestor directories

Those defaults are meant to reduce obvious local-surface risk and keep product claims honest.
They do **not** mean Microcanvas is a general sandbox for arbitrary hostile web content or a replacement for a hardened browser isolation boundary.
