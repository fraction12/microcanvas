## 1. App Bundle Build Path

- [x] 1.1 Add a repo-owned script that builds the SwiftPM `MicrocanvasViewer` product and materializes `MicrocanvasViewer.app`.
- [x] 1.2 Add an `Info.plist` template or generation step with bundle identifier, executable name, app name, and minimum metadata needed for macOS GUI launch.
- [x] 1.3 Ensure the generated `.app` bundle includes the current viewer executable and launches with `--repo-root` support intact.
- [x] 1.4 Update `.gitignore` or build-output hygiene so generated `.app` output is not tracked or packed.

## 2. Native Launch Flow

- [x] 2.1 Update viewer launch path discovery to prefer the generated `MicrocanvasViewer.app` on macOS.
- [x] 2.2 Launch the `.app` through macOS app semantics while passing the runtime repo root.
- [x] 2.3 Preserve SwiftPM/raw executable launch as a development fallback when the app bundle is missing or cannot be built.
- [x] 2.4 Keep degraded external display fallback for default `show` when native launch cannot be verified.

## 3. Heartbeat and Diagnostics

- [x] 3.1 Require a fresh `runtime/viewer-state.json` heartbeat before reporting `viewer.mode: native`.
- [x] 3.2 Confirm the heartbeat process is alive and associated with the current active surface when a surface match is expected.
- [x] 3.3 Add structured launch diagnostics for attempted launch method, heartbeat state, timeout, surface mismatch, and fallback decision.
- [x] 3.4 Add strict native mode through a CLI flag, environment variable, or both, returning viewer-launch failure instead of degraded fallback.

## 4. Tests

- [x] 4.1 Add unit coverage for app-bundle path resolution and fallback ordering.
- [x] 4.2 Add unit coverage for missing, stale, mismatched, and successful heartbeat states.
- [x] 4.3 Add CLI contract coverage for default degraded fallback with native launch diagnostics.
- [x] 4.4 Add CLI contract coverage for strict native failure when no valid heartbeat appears.
- [x] 4.5 Add macOS viewer validation for the generated `.app` build path where practical.

## 5. Documentation and Verification

- [x] 5.1 Document the local `.app` build path and native launch troubleshooting flow.
- [x] 5.2 Document strict native mode for workflows that require verify/snapshot support.
- [x] 5.3 Run `npm run check`.
- [x] 5.4 Run `npm test`.
- [x] 5.5 Run `swift test` in `apps/macos-viewer/MicrocanvasViewer`.
- [x] 5.6 Run the app-bundle build script and confirm `MicrocanvasViewer.app` launches the active surface.
- [x] 5.7 Run `openspec validate package-native-viewer-app --strict`.
