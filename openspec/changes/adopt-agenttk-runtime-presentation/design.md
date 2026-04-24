## Design

This change is a future decision point, not part of the pass-1 cleanup. AgentTK `0.1.6` can own more of the CLI runtime, but Microcanvas currently has product-specific presentation behavior that users and tests rely on.

## Current Differences

### Dispatch

Microcanvas currently returns `UNKNOWN_COMMAND` for unknown commands.
AgentTK `createTool` / `runToolCli` currently falls back to tool help for unknown commands.

Before adopting `runToolCli`, decide whether to:

1. Keep `UNKNOWN_COMMAND` by extending AgentTK or wrapping it.
2. Accept AgentTK help fallback as the new behavior.
3. Ask AgentTK to support configurable unknown-command behavior upstream.

### Human output

Microcanvas currently emits branded, compact output such as:

- `OK Status`
- `ERR Verify failed`
- `Next: verify state`
- custom surface/viewer/artifact lines

AgentTK default rendering emits generic saved/error wording and raw metadata names. AgentTK presentation hooks can format record fields, but they do not yet replace Microcanvas failure/help formatting or color palette behavior.

## Proposed Implementation Path

1. Export or centralize the Microcanvas tool definition so tests can exercise it directly.
2. Prototype `runToolCli` behind tests and compare exact JSON/human output.
3. Choose the unknown-command behavior explicitly.
4. Either:
   - keep Microcanvas presentation and only adopt AgentTK dispatch if configurable, or
   - accept AgentTK presentation as a deliberate human-output change.

## Open Questions

- Should unknown commands remain machine failures, or should help fallback be treated as friendlier?
- Is branded human output part of the supported contract, or only JSON?
- Should AgentTK grow an extension point for custom failure/help rendering before Microcanvas adopts `runToolCli`?
