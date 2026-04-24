## Why

AgentTK `0.1.6` now provides small runtime helpers that overlap with Microcanvas CLI glue. We can remove duplicated argument parsing and result-helper code while keeping the current JSON and human output contracts stable.

## What Changes

- Use AgentTK `firstPositional` and `hasFlag` for `show` and `update` argument parsing.
- Use AgentTK common result helpers for invalid-input, lock, and operational failures while preserving Microcanvas-specific error codes.
- Keep Microcanvas custom CLI dispatch and presentation in place for this pass.
- Keep existing command behavior, JSON envelopes, human output, and tests unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transport-integration`: Preserve the existing AgentTK-native CLI contract while relying on AgentTK `0.1.6` helpers for compatible internal plumbing.

## Impact

- Affected code: `src/cli/contracts.ts`, `src/cli/commands/show.ts`, `src/cli/commands/update.ts`.
- Affected tests: existing CLI and presentation tests should remain the compatibility guard.
- API surface: no intentional external behavior change.
