![Microcanvas banner](docs/assets/readme-banner.png)

# microcanvas

A lightweight, reliable canvas runtime and viewer for AI coding tools.

Microcanvas is a standalone, tool-agnostic canvas tool that covers the same core job as OpenClaw Canvas, but in a smaller, more predictable form. Agents call Microcanvas like any other tool. Microcanvas owns rendering, activation, verification, and viewer-backed snapshots.

## What works today

- `render` renders a supported source into staging
- `show` activates a surface and prefers the native Microcanvas viewer, while still supporting degraded external-open fallback when the native viewer is unavailable
- `update` refreshes the active surface while preserving surface identity and reporting whether the runtime is native-capable or degraded
- `status` reports runtime state, active artifacts, viewer mode, and whether native verification is currently possible
- `verify` checks active surface files plus native-viewer-backed evidence for the active surface
- `snapshot` captures a real PNG from the native viewer window when native viewer capability is available

## CLI contract

Microcanvas now treats AgentTK as the canonical CLI/result layer. JSON output is no longer the old custom top-level `code/message/viewer/lock/artifacts` object.

Success responses return:
- `ok: true`
- `record`: Microcanvas-specific runtime data such as `surfaceId`, active artifact paths, lock state, and viewer mode
- `warnings`: optional warnings, especially when a command succeeds in degraded mode
- `verificationStatus`: whether the result is viewer-verified or unverified
- `nextAction`: optional follow-up guidance when the result is useful but not fully verifiable

Failure responses return:
- `ok: false`
- `error.code`: stable domain code such as `INVALID_INPUT`, `UNSUPPORTED_CONTENT`, `LOCKED_TRY_LATER`, `SURFACE_NOT_FOUND`, `UPDATE_NOT_SUPPORTED`, or `VERIFY_FAILED`
- `error.message`: human-readable failure detail

Example success envelope from degraded `show`:

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

Example failure envelope from degraded `verify`:

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_FAILED",
    "message": "Native viewer-backed verification is unavailable while viewer mode is degraded."
  }
}
```

## Viewer modes

Microcanvas distinguishes between viewer display success and native viewer-backed capability.

- `native`: the Microcanvas viewer is confirmed available and can satisfy heartbeat-backed `verify` and `snapshot`
- `degraded`: the active artifact was opened through an external OS fallback, but native viewer-backed verification and snapshot flows are unavailable
- `closed`: there is no confirmed display session

This distinction matters:
- `show` and `update` may still succeed in degraded mode because the active artifact was opened successfully
- `status` is the non-strict inspection command and should tell you which mode the runtime is in
- `verify` and `snapshot` stay strict and require native viewer capability

## Supported content today

Microcanvas is deliberately honest about supported formats.

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

If a file type is not supported, Microcanvas returns `UNSUPPORTED_CONTENT` instead of pretending success.

## Runtime model

Microcanvas keeps a canonical runtime root with:
- `runtime/active/`
- `runtime/staging/`
- `runtime/snapshots/`
- `runtime/state.json`
- `runtime/viewer-state.json`
- request/response files used for viewer snapshot handoff

The runtime state is expected to expose enough information for `status` and JSON callers to tell:
- which surface is active
- which artifact is the active entry
- whether the runtime is `native`, `degraded`, or `closed`
- whether native verification is currently possible
- whether a write lock is held

## Current viewer model

- native macOS viewer is still the preferred display path
- single active window
- single active surface at a time
- `wkwebview` surfaces for html, generated html, and CSV-backed table surfaces
- native PDF display for pdf surfaces
- native image display for png, jpg/jpeg, gif, and webp surfaces
- viewer heartbeat written into runtime state when the native viewer is active
- viewer-backed verify and snapshot flows remain native-only

## Safety stance

- no path traversal
- no symlink escapes
- source paths must resolve inside allowed roots
- unsupported formats fail clearly

## Internal structure

Surface detection and materialization now run through a lightweight adapter registry in `src/core/surface.ts`.
Each supported family declares its extensions, manifest/viewer contract, and any deterministic transform in one place, which keeps the refactor explicit and reversible without changing the content model.

## Current status

This is a working prototype with a real native viewer path, explicit degraded fallback semantics, viewer-backed verification and snapshots, write-lock discipline, and regression coverage around the core command flows.
