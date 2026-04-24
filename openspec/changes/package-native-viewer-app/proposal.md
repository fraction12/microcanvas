## Why

The native viewer currently launches from a SwiftPM executable path, which is brittle for macOS GUI activation and heartbeat detection. Packaging the viewer as a proper `.app` bundle gives Microcanvas a stable launch target, cleaner process identity, and a more reliable native verification path.

## What Changes

- Add a supported macOS `.app` bundle build path for `MicrocanvasViewer`.
- Teach the CLI/viewer launcher to prefer the `.app` bundle for native viewer launch.
- Keep SwiftPM/raw executable launch as development fallback paths, but do not treat them as the primary production path.
- Add a strict native launch handshake that waits for a fresh `viewer-state.json` heartbeat matching the active surface before reporting native verification capability.
- Preserve degraded external display fallback for non-strict flows, while making native-required failures explicit and diagnosable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-model`: The standalone macOS viewer requirement will define a packaged `.app` bundle as the primary native launch unit and require a fresh heartbeat before native mode is reported.
- `transport-integration`: CLI outcomes will distinguish packaged native viewer launch success, explicit native launch failure, and degraded display fallback.

## Impact

- Affected code: macOS viewer package/build scripts, native viewer launch code, viewer status/verification logic, tests around launch states, and documentation for local viewer development.
- API surface: existing `show`, `status`, `verify`, and `snapshot` commands stay compatible; strict native behavior may be added through a flag or environment variable.
- Distribution: npm package contents may include a build script or documented local build path for the `.app`, but generated `.app` output should not be committed.
- Risk: `.app` bundling introduces macOS-specific build details, so the implementation must keep CLI/runtime contracts portable and keep non-macOS fallback behavior honest.
