## Context

Microcanvas already has the right product boundary for a small canvas runtime: deterministic staging/active/snapshot state, a preferred native macOS viewer, and explicit command flows for render, show, update, verify, snapshot, and status. The current CLI implementation, however, sits awkwardly on top of AgentTK rather than using it as the canonical contract.

Today the CLI defines its own result envelope in [`src/core/results.ts`](/Volumes/MacSSD/Projects/microcanvas/src/core/results.ts:1) and captures `stdout` in [`src/cli/index.ts`](/Volumes/MacSSD/Projects/microcanvas/src/cli/index.ts:67) so command implementations can keep printing JSON. At the same time, viewer launch currently treats a successful native launch and a generic `open` fallback as the same `viewer.open = true` state, even though only the native viewer can satisfy heartbeat-backed `verify` and `snapshot` flows.

This change is cross-cutting because it touches command dispatch, command result modeling, viewer launch/state bookkeeping, runtime inspection behavior, and the CLI tests/docs that currently encode the custom result shape.

## Goals / Non-Goals

**Goals:**
- Make AgentTK the canonical command/result layer instead of wrapping it with a second result model.
- Preserve degraded display support when the native viewer is unavailable.
- Expose viewer mode and verification capability explicitly so callers can tell whether they have native viewer backing or only an external-open fallback.
- Keep domain-specific error semantics stable enough that callers can still reason about unsupported content, invalid input, lock contention, missing surfaces, and verification failures.
- Update tests and docs in the same change so the new CLI contract becomes the new source of truth.

**Non-Goals:**
- No broad expansion of supported surface families.
- No redesign of the runtime directory layout or staging/active promotion flow.
- No removal of the native macOS viewer as the preferred display path.
- No attempt to preserve the old top-level JSON envelope indefinitely for compatibility.
- No cross-platform viewer implementation in this change.

## Decisions

### 1. Adopt AgentTK-native command results end to end

Microcanvas will stop using the custom `CommandResult` type in [`src/core/results.ts`](/Volumes/MacSSD/Projects/microcanvas/src/core/results.ts:1) as the canonical CLI contract. Each command handler will instead return AgentTK `ok(...)` / `fail(...)` results directly, and [`src/cli/index.ts`](/Volumes/MacSSD/Projects/microcanvas/src/cli/index.ts:46) will let AgentTK own dispatch, `--json`, help rendering, and human output.

The result record will still carry Microcanvas-specific data such as surface identifiers, active artifact paths, lock state, and viewer mode, but it will live inside AgentTK's `record`, `warnings`, and mutation-safety metadata instead of a parallel envelope.

Alternatives considered:
- Preserve the old JSON shape and translate internally to/from AgentTK. Rejected because it keeps two contracts alive and preserves the current wrapper complexity.
- Keep the current model and only patch viewer semantics. Rejected because it solves the symptoms but leaves the CLI off the SDK happy path.

### 2. Introduce explicit viewer modes instead of a single boolean

Viewer state will distinguish at least these runtime modes:
- `native`: the Microcanvas viewer is confirmed available for heartbeat-backed operations.
- `degraded`: the active artifact was opened through an external OS fallback, but native viewer-backed verify/snapshot flows are unavailable.
- `closed` or equivalent absence of viewer state.

`show` and `update` will prefer the native viewer. If native launch is unavailable but the artifact can still be opened externally, the command will succeed in degraded mode. That result will carry warnings plus AgentTK verification metadata indicating that the operation is unverified and that the next meaningful action is to re-check state through a native-capable viewer path.

Alternatives considered:
- Treat any successful open as `open=true`. Rejected because it repeats the current ambiguity.
- Fail `show`/`update` unless the native viewer is available. Rejected because the user explicitly wants degraded support and the tool still provides value in that mode.

### 3. Keep `verify` and `snapshot` native-viewer-backed

`verify` and `snapshot` will remain native-viewer-backed operations. In degraded mode they will fail clearly rather than quietly inferring success from the last launch attempt.

This preserves an important semantic boundary:
- display success means the tool materialized and opened something useful
- verification success means the native viewer has confirmed the active surface
- snapshot success means the native viewer completed the request/response handshake and wrote an artifact

Alternatives considered:
- Redefine `verify` to mean only filesystem/runtime checks when degraded. Rejected because it would dilute the meaning of verification and make the command less trustworthy.
- Add a second verification command in this change. Rejected as unnecessary scope expansion; `status` can carry the softer inspection story.

### 4. Expand `status` into the soft-inspection command

`status` will become the place where callers can inspect native-vs-degraded viewer state without triggering strict failure semantics. It should report:
- active surface identity if present
- lock state
- viewer mode/capability
- whether native verification is currently possible
- enough manifest-derived artifact information to find the active entry

This keeps `status` informative while letting `verify` remain strict.

Alternatives considered:
- Keep `status` boolean-only and force callers to infer mode elsewhere. Rejected because it perpetuates the ambiguity that caused the issue.

## Risks / Trade-offs

- [Breaking JSON contract for existing callers] → Update README, tests, and OpenSpec artifacts in the same change; keep domain error codes stable within AgentTK failure envelopes so migration is mechanical.
- [AgentTK human rendering may be less tailored than the current custom formatter] → Shape the success `record` fields and warnings intentionally so default human output remains readable.
- [Degraded mode could still be mistaken for full capability by future contributors] → Encode viewer mode explicitly in runtime state and in result records, and add regression tests around degraded `show`/`update` plus failing `verify`/`snapshot`.
- [Status surface may grow too implementation-specific] → Limit it to stable caller-relevant state: surface identity, viewer mode, verification capability, lock state, and active artifact references.

## Migration Plan

1. Replace the custom CLI wrapper with direct AgentTK command handlers that return structured results.
2. Introduce viewer-mode state and update launch/state helpers to set `native` vs `degraded` explicitly.
3. Update `show`, `update`, `status`, `verify`, and `snapshot` to use the new state/capability model.
4. Rewrite CLI tests to assert on AgentTK-native envelopes and the degraded/native behavior split.
5. Update README and any spec/doc references that describe the old custom result shape.

Rollback is straightforward because the change is local to the CLI/runtime/viewer layer. Reverting the commit would restore the old result model and launch semantics together.

## Open Questions

- None for this proposal. The main product decisions are resolved: degraded display remains supported, native viewer stays preferred, and the CLI contract becomes AgentTK-native.
