## Why

AgentTK `0.1.6` adds `runToolCli` and presentation hooks that could remove more Microcanvas CLI plumbing. This needs a separate spec because adopting those surfaces may affect unknown-command behavior and human output.

## What Changes

- Evaluate replacing Microcanvas custom dispatch/help emission with AgentTK `runToolCli`.
- Evaluate replacing or narrowing `src/cli/presentation.ts` through AgentTK presentation hooks.
- Decide whether Microcanvas keeps branded/humanized output or adopts AgentTK default output.
- Define compatibility expectations for unknown commands, help JSON, and operator-facing text before implementation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transport-integration`: Define how much of CLI runtime dispatch and human presentation is delegated to AgentTK.

## Impact

- Affected code: `src/cli/index.ts`, `src/cli/presentation.ts`, CLI presentation tests, and command help tests.
- Potential behavior changes: unknown-command output and human-readable command output.
- API surface: JSON output should remain stable unless the spec explicitly accepts a breaking change.
