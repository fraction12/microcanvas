![Microcanvas banner](docs/assets/readme-banner.png)

# microcanvas

![stage: early](https://img.shields.io/badge/stage-early-orange)
![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![platform: macOS-first](https://img.shields.io/badge/platform-macOS--first-blue)
![focus: AI tooling](https://img.shields.io/badge/focus-AI%20tooling-teal)

Microcanvas is a tiny stagehand for AI tools: it renders supported files, opens them in a viewer, keeps track of the active surface, and helps agents verify what they are showing.

It is usable today, still early-stage, and very happy to hold the curtain open while your tool says, "Would you like me to show it on Microcanvas?"

## Why Microcanvas Exists

Most coding agents eventually need the same thing: a predictable place to render a file, open it, update it, inspect runtime state, and grab evidence that the right thing is on screen.

Microcanvas exists to do that job cleanly.

- Render a source file into a surface
- Show the active surface in a native viewer when available
- Update the active surface without losing identity
- Report runtime and viewer state in a tool-friendly way
- Verify or snapshot the active surface when native viewer capability is present

This repo is intentionally focused. It is not trying to be a full document suite, a browser automation framework, or a giant cross-platform GUI toolkit.

## What The Claws Can Do Today

- `render` stages a supported source into a Microcanvas surface
- `show` activates a surface and opens it, preferring the native Microcanvas viewer
- `update` refreshes the active surface while keeping surface identity intact
- `status` reports runtime state, active artifact, lock state, and viewer capability
- `verify` checks active files plus native-viewer-backed confirmation for the active surface
- `snapshot` captures a real PNG from the native viewer when snapshot capability is available

## Take It For A Spin

Microcanvas is currently set up for local repo installs rather than npm publishing.

```bash
npm install
npm link
microcanvas show README.md
microcanvas status --json
```

That gives you the happy-path tour:

- `npm link` installs the repo-local CLI as `microcanvas`
- `show README.md` opens this README as the active surface
- `status --json` reports the runtime and viewer state in a tool-friendly format

Once a surface is active, the next useful moves are:

```bash
microcanvas update README.md
microcanvas verify --json
microcanvas snapshot --json
```

If you want to undo the local install later, run:

```bash
npm unlink -g microcanvas
```

## Quick Command Tour

### Show Something Off

```bash
microcanvas show path/to/file.md
microcanvas show path/to/file.png
microcanvas show path/to/file.csv --json
```

Use `show` when you want Microcanvas to render if needed, activate the result, and open it.

### Stage Without Opening

```bash
microcanvas render path/to/file.md --json
```

Use `render` when you want a staged surface artifact without activating it yet.

### Refresh The Active Surface

```bash
microcanvas update path/to/file.md --json
```

Use `update` when a surface is already active and you want to refresh it in place.

### Ask What Is Going On

```bash
microcanvas status --json
microcanvas verify --json
```

Use `status` for inspection. Use `verify` when you need strict confirmation that the active surface and viewer state line up.

### Grab A Snapshot

```bash
microcanvas snapshot --json
```

When native snapshot capability is available, Microcanvas writes a real PNG snapshot and reports its path in the command result.

## Supported Content

Microcanvas is deliberately honest about what it can display today.

Supported now:

- `.html`, `.htm`
- `.md`, `.markdown`
- `.pdf`
- `.csv` rendered into a deterministic HTML table surface
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- `.txt`, `.json`, `.js`, `.ts` wrapped into an HTML code-view surface

Not supported yet:

- arbitrary binary artifacts
- archives like `.zip`
- `.svg` and other image-like formats without an explicit display path
- office docs and other formats without an explicit render/display path

If a file type is not supported, Microcanvas returns `UNSUPPORTED_CONTENT` instead of pretending everything is fine.

## Viewer Modes

Microcanvas separates "something opened" from "the native viewer is fully available."

- `native`: the Microcanvas viewer heartbeat is fresh and can satisfy `verify` and `snapshot`
- `degraded`: the active artifact opened through an external fallback path, but native verification and snapshot flows are unavailable
- `closed`: there is no confirmed viewer session

This matters in practice:

- `show` and `update` only report `native` after the viewer heartbeat confirms readiness, and the native app brings its window to the front when new content is presented when macOS allows it
- if an older native viewer session is still hanging around, Microcanvas clears that stale session before trusting a new launch attempt
- `show` and `update` can still succeed in degraded mode
- `status` tells you what kind of runtime/viewer state you currently have
- `verify` stays strict and requires native viewer-backed confirmation
- `snapshot` is strongest when native capture capability is available

## JSON Contract

Microcanvas treats AgentTK as the canonical CLI/result layer.

Success responses return:

- `ok: true`
- `record`: Microcanvas runtime data such as `surfaceId`, artifact paths, lock state, and viewer mode
- `warnings`: optional warnings, especially for degraded-mode success
- `verificationStatus`: whether the result is verified, unverified, or not applicable
- `nextAction`: optional follow-up guidance when the result is useful but not fully verifiable

Failure responses return:

- `ok: false`
- `error.code`: stable domain codes such as `INVALID_INPUT`, `UNSUPPORTED_CONTENT`, `LOCKED_TRY_LATER`, `SURFACE_NOT_FOUND`, `UPDATE_NOT_SUPPORTED`, or `VERIFY_FAILED`
- `error.message`: human-readable failure detail

Example degraded `show` response:

```json
{
  "ok": true,
  "record": {
    "surfaceId": "surface-123",
    "artifacts": {
      "primary": "/path/to/runtime/active/index.html"
    },
    "viewer": {
      "mode": "degraded",
      "open": true,
      "canVerify": false
    },
    "lock": {
      "held": false
    }
  },
  "warnings": [
    "Native viewer is unavailable; opened the active artifact through the degraded external display path."
  ],
  "verificationStatus": "unverified",
  "nextAction": "verify_state"
}
```

Example degraded `verify` failure:

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_FAILED",
    "message": "Native viewer confirmation is unavailable while the runtime is in degraded display mode"
  }
}
```

## Runtime Shape

Microcanvas keeps a canonical runtime root with:

- `runtime/active/`
- `runtime/staging/`
- `runtime/snapshots/`
- `runtime/state.json`
- `runtime/viewer-state.json`
- request/response files used for viewer snapshot handoff

That gives tools a stable place to inspect:

- which surface is active
- which artifact is the active entry
- whether the runtime is `native`, `degraded`, or `closed`
- whether native verification is currently possible
- whether a write lock is held

## Known Barnacles

Microcanvas is usable early-stage software, so a few edges are still showing:

- the native viewer path is currently macOS-first
- only one active window and one active surface are supported at a time
- `verify` and `snapshot` are intentionally strict about native viewer capability
- unsupported formats fail clearly instead of being guessed into submission
- the package is not published yet; right now the easiest path is running from source

## Agent Skill

Microcanvas ships with a tracked agent skill at `skills/microcanvas-present/` so agents use the CLI the way it is actually meant to be used.

Install local copies for common agent folders:

```bash
npm run install:skills
```

Use the repo-local wrapper directly when you want deterministic behavior:

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh show README.md --json
```

For concrete agent flows, see `skills/microcanvas-present/references/cookbook.md`.

## Development

```bash
npm install
npm link
npm run check
npm test
```

The current implementation is small on purpose. Surface detection and materialization run through the adapter registry in [`src/core/surface.ts`](src/core/surface.ts), which keeps format support explicit and easier to extend without turning the content model into soup.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and expectations.

## Security

If you believe you found a security issue, please use the process in [`SECURITY.md`](SECURITY.md).

## License

Microcanvas is available under the [MIT License](LICENSE).
