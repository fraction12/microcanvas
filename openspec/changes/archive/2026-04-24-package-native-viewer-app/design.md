## Context

Microcanvas has a native macOS viewer, but today the CLI treats the SwiftPM build executable as the primary launch target. That path can render surfaces once manually started, but it is not a reliable macOS application launch unit: GUI activation, process identity, and heartbeat detection can fail or race, causing `show` to fall back to degraded display even when the viewer binary exists.

The durable fix is to package the native viewer as `MicrocanvasViewer.app` and make that app bundle the primary launch target. The CLI should then verify the native viewer through a fresh heartbeat before claiming native mode, verification, or snapshot capability.

## Goals / Non-Goals

**Goals:**

- Provide a deterministic local build path for `MicrocanvasViewer.app`.
- Prefer the `.app` bundle when launching the native viewer on macOS.
- Keep SwiftPM/raw executable launch paths available for development fallback.
- Make native launch success depend on a fresh `viewer-state.json` heartbeat matching the active surface.
- Add diagnostics that explain why native launch failed and whether degraded fallback was used.

**Non-Goals:**

- Ship a signed/notarized public macOS release artifact.
- Replace SwiftUI/AppKit/WebKit viewer internals.
- Remove degraded fallback for normal `show` flows.
- Add cross-platform native viewer support.

## Decisions

### Build a local `.app` bundle from the existing SwiftPM product

The implementation should add a repo-owned script, for example under `apps/macos-viewer/scripts/`, that creates a local `MicrocanvasViewer.app` bundle from the SwiftPM-built executable. The bundle should include a minimal `Info.plist`, `MacOS/MicrocanvasViewer`, and any metadata needed for macOS to treat it as an application.

Alternatives considered:

- Use raw SwiftPM executable directly: simple, but it is the failure mode this change is addressing.
- Require Xcode project generation: heavier than the current package structure and unnecessary for a local development bundle.
- Commit generated `.app` output: bloats the repo and violates the generated-artifact hygiene we just established.

### Make the `.app` the primary native launch target

The CLI launch flow should locate or build the app bundle and launch it through macOS app semantics. It should pass `--repo-root` so the viewer writes heartbeat and snapshot files into the correct runtime root.

Fallback order should be:

1. Packaged `MicrocanvasViewer.app`.
2. SwiftPM/raw executable development launch, only when the app bundle is unavailable or build fails.
3. Degraded external display, only when native mode is not required.

### Treat heartbeat as the native contract

The CLI should report `viewer.mode: native` only when it observes a fresh `runtime/viewer-state.json` heartbeat from a live process and the heartbeat active surface matches the current active surface when applicable. The presence of a binary or a launched process is not enough.

### Add strict native behavior without breaking default fallback

Default `show` can still fall back to degraded display so the user sees something. A strict native path, exposed through a flag or environment variable, should fail with a machine-friendly viewer-launch error instead of silently degrading.

## Risks / Trade-offs

- `.app` build details drift from SwiftPM output -> Keep the bundle script small, tested, and driven from `swift build`.
- Local unsigned app launch may behave differently across macOS versions -> Keep fallback paths and report the exact launch method used.
- Longer heartbeat waits slow failures -> Use bounded polling with clear timeout diagnostics.
- Strict native behavior adds another mode -> Keep default behavior compatible and make strict mode opt-in.

## Migration Plan

1. Add `.app` bundle creation without changing default launch behavior.
2. Teach the CLI to prefer the app bundle and record launch diagnostics.
3. Add strict heartbeat-gated native reporting.
4. Update tests and docs.
5. Keep generated app output ignored and out of npm package dry-runs.

Rollback is straightforward: disable the app-bundle launch path and fall back to the current SwiftPM/raw executable launch behavior while keeping diagnostics intact.

## Open Questions

- Should strict native mode be exposed as `microcanvas show --native`, `MICROCANVAS_REQUIRE_NATIVE_VIEWER=1`, or both?
- Where should the generated `.app` live: SwiftPM `.build/` output, a repo-local generated `apps/macos-viewer/build/`, or both with one canonical path?
