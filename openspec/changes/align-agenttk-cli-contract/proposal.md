## Why

Microcanvas currently wraps AgentTK with a custom JSON result shape and a stdout-capture dispatch layer, while also treating any successful `open` fallback as equivalent to a native viewer session. That makes the CLI harder to evolve, and it blurs the difference between "content was opened somewhere" and "viewer-backed verify/snapshot flows are actually available."

## What Changes

- Align the CLI with AgentTK's native result envelope instead of maintaining a parallel top-level `ok/code/message/viewer/lock/artifacts` contract.
- Define explicit viewer operating modes so the runtime can distinguish a native Microcanvas viewer session from a degraded external-open fallback.
- Allow `show` and `update` to succeed in degraded mode when the native viewer is unavailable, while marking the result as unverified and warning that viewer-backed flows are unavailable.
- Tighten `status`, `verify`, and `snapshot` semantics so they report or enforce native-viewer capability explicitly instead of inferring too much from a generic "open" flag.
- Remove the CLI stdout-capture bridge and let AgentTK own command dispatch and rendering directly.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-model`: display flows now distinguish native viewer sessions from degraded external-open sessions, and viewer-backed operations are gated on native capability.
- `transport-integration`: CLI results and status reporting now follow an AgentTK-native machine contract and expose degraded-vs-native viewer state explicitly.

## Impact

- Affected code: [src/cli/index.ts](/Volumes/MacSSD/Projects/microcanvas/src/cli/index.ts:1), [src/cli/commands](/Volumes/MacSSD/Projects/microcanvas/src/cli/commands), [src/core/results.ts](/Volumes/MacSSD/Projects/microcanvas/src/core/results.ts:1), [src/viewer/launch.ts](/Volumes/MacSSD/Projects/microcanvas/src/viewer/launch.ts:1), [src/viewer/state.ts](/Volumes/MacSSD/Projects/microcanvas/src/viewer/state.ts:1), [src/viewer/snapshot.ts](/Volumes/MacSSD/Projects/microcanvas/src/viewer/snapshot.ts:1), [test/cli.test.mjs](/Volumes/MacSSD/Projects/microcanvas/test/cli.test.mjs:1).
- API surface: JSON output for core commands becomes AgentTK-native and will be a breaking change for callers that parse the current custom result shape.
- Dependencies/systems: AgentTK becomes the canonical command/result layer rather than a wrapped helper; the native macOS viewer remains the preferred path, but degraded external-open behavior becomes an explicit supported mode.
