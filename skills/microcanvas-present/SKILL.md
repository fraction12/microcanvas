---
name: microcanvas-present
description: Present local artifacts with the Microcanvas CLI the right way. Use when the user wants something shown on Microcanvas, opened visually, rendered for review, updated in place, verified, or snapshotted. Trigger for diagrams, HTML, markdown, images, CSVs, PDFs, and code/text files when chat output is the wrong surface.
---

# Microcanvas Present

Use Microcanvas as a presentation layer, not as a generic opener.

## Default path

Use the bundled wrapper first:

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh <command> ... --json
```

That wrapper:
- runs from the repo root
- avoids stale global `microcanvas` installs
- builds the repo-local CLI if `dist/cli/index.js` is missing

## Quick decision rule

- first time showing something -> `show`
- revising what is already on screen -> `update`
- preparing a surface without opening it -> `render`
- checking what is live right now -> `status --json`
- needing strict native confirmation -> `verify --json`
- needing a real PNG from the native viewer -> `snapshot --json`

If you are unsure, start with `show`.

## Safe workflow

1. Confirm the source file exists and use an absolute path when in doubt
2. Use `show ... --json` for the first visual
3. Read `record.viewer.mode` and `record.viewer.open`
4. If `viewer.mode` is `native`, `verify` and `snapshot` are available
5. If `viewer.mode` is `degraded`, presentation may still be fine, but do not claim native verification or snapshot capability
6. Use `update ... --json` only after a surface is already active
7. Use `status --json` before diagnosing odd behavior or claiming success

## Preflight checks

Before saying a visual is ready, check:
- did the command return `ok: true`
- which `viewer.mode` came back: `native`, `degraded`, or `closed`
- is the active artifact the file you meant to show
- do you actually need `verify` or `snapshot`, or just a visible presentation

## Supported content

Supported now:
- `.html`, `.htm`
- `.md`, `.markdown`
- `.pdf`
- `.csv`
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- `.txt`, `.json`, `.js`, `.ts`

Not supported yet:
- `.zip`
- `.svg`
- arbitrary binaries
- office docs without a deliberate conversion step

If content is unsupported, convert it deliberately or let Microcanvas return `UNSUPPORTED_CONTENT`. Do not fake support.

## Important semantics

- One active surface at a time
- `show` and `update` can succeed in degraded mode
- `verify` is strict and may fail in degraded mode with `VERIFY_FAILED`
- `snapshot` is meaningful only when native snapshot capability is present
- The goal is “put the right artifact in front of the user cleanly,” not “open some file somehow”
- if the user wants iteration on the same thing, prefer `update` over a fresh `show`
- if the source format is unsupported, convert it deliberately rather than bluffing

## Common examples

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh show /absolute/path/to/mockup.html --json
skills/microcanvas-present/scripts/run-microcanvas.sh update /absolute/path/to/mockup.html --json
skills/microcanvas-present/scripts/run-microcanvas.sh status --json
skills/microcanvas-present/scripts/run-microcanvas.sh verify --json
skills/microcanvas-present/scripts/run-microcanvas.sh snapshot --json
```

For worked usage patterns, read `skills/microcanvas-present/references/cookbook.md`.

## Avoid these mistakes

- Do not rely on a global `microcanvas` binary when repo-local correctness matters
- Do not use `update` before a surface is active
- Do not promise a screenshot or verification if `viewer.mode` is not `native`
- Do not treat fallback open behavior as proof that native viewer state is healthy
- Do not dump ASCII diagrams into chat when the user explicitly wants a visual review surface
