## Design

This is a dependency update, not a CLI refactor.

Microcanvas already treats AgentTK as the canonical command/result layer. The safe path is to bump AgentTK to `0.1.6`, run the existing TypeScript and CLI regression suites, and inspect the updated package surface for follow-up simplification opportunities.

## Scope

In scope:

- Update `agenttk` to `0.1.6`.
- Refresh lockfile metadata through the package manager.
- Run focused validation for compile-time compatibility and CLI behavior.
- Validate the OpenSpec change.

Out of scope:

- Replacing Microcanvas presentation output with new AgentTK rendering helpers.
- Removing Microcanvas-specific command/result helper wrappers.
- Changing JSON or human CLI output.

## Follow-up Direction

After this update lands, a separate cleanup change can evaluate whether AgentTK `createTool`, `renderResult`, recovery helpers, and test helpers can remove code from `src/cli/index.ts`, `src/cli/contracts.ts`, and CLI tests without weakening Microcanvas-specific output.
