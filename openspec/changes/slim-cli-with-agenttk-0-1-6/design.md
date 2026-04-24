## Design

This pass is intentionally conservative: adopt AgentTK helper functions where they are drop-in internal replacements, and leave the larger runtime/presentation delegation decision for a separate spec.

## Approach

### Argument parsing

Replace the duplicated strict-native parsing in `show` and `update` with:

- `hasFlag(rawArgs, ['--native', '--strict-native'])`
- `firstPositional(rawArgs, ['--native', '--strict-native'])`

This keeps behavior stable while moving flag handling to AgentTK.

### Result helpers

Map Microcanvas wrappers to AgentTK result blocks:

- `inputFailure` -> `invalidInput(...)` with the existing domain code override.
- `lockFailure` -> `lockedOrBusy(...)` with `LOCKED_TRY_LATER`.
- `operationalFailure` -> AgentTK `operationalFailure(...)` with the existing domain code override.

Keep `successResult` because Microcanvas sets `destination: "runtime"` consistently.
Keep `viewerLaunchFailure` as a Microcanvas-specific wrapper because it carries launch diagnostics and mutation-safety metadata.

## Non-Goals

- No adoption of `runToolCli` in this pass.
- No replacement of `src/cli/presentation.ts`.
- No changes to unknown-command behavior.
- No changes to human output wording or JSON output shape.
