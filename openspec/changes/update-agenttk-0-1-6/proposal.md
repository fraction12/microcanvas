## Why

AgentTK has a new `0.1.6` release, and Microcanvas should stay on the current CLI-contract toolkit before we decide which wrappers can be simplified.

## What Changes

- Update the `agenttk` package requirement and lockfile to `0.1.6`.
- Verify the existing AgentTK-backed Microcanvas CLI contract still passes type checks and tests.
- Leave any deeper CLI simplification for a follow-up change after the dependency update is stable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transport-integration`: Keep the AgentTK-native CLI contract compatible with the current AgentTK release.

## Impact

- Affected files: `package.json`, `package-lock.json`, and the generated dependency install state.
- Affected systems: Microcanvas CLI command dispatch, result envelopes, and human/JSON command output.
- API surface: no intentional CLI behavior change.
