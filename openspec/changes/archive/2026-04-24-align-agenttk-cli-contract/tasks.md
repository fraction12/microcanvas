## 1. Align the CLI with AgentTK

- [x] 1.1 Replace the custom result-printing path in `src/cli/index.ts` with direct AgentTK command dispatch and rendering.
- [x] 1.2 Refactor command modules to return AgentTK-native success and failure envelopes instead of writing the current custom JSON result shape.
- [x] 1.3 Remove or repurpose `src/core/results.ts` so the CLI has one canonical result contract.

## 2. Model native vs degraded viewer state

- [x] 2.1 Introduce explicit viewer mode/capability state for native, degraded, and closed viewer conditions.
- [x] 2.2 Update viewer launch helpers so `show` and `update` prefer the native viewer and fall back to degraded external-open mode when necessary.
- [x] 2.3 Update snapshot and viewer-state helpers so native-only operations are gated on native viewer capability rather than a generic open flag.

## 3. Update command semantics

- [x] 3.1 Update `show` and `update` to succeed in degraded mode with warnings and unverified metadata when the native viewer is unavailable.
- [x] 3.2 Update `status` to report viewer mode, verification capability, lock state, active surface, and active artifact references.
- [x] 3.3 Update `verify` and `snapshot` to fail clearly when only degraded mode is available.

## 4. Refresh tests and docs

- [x] 4.1 Rewrite CLI tests to assert on the AgentTK-native envelope and the native-vs-degraded behavior split.
- [x] 4.2 Update README and any contract-facing docs to describe the new result model and degraded viewer semantics.
- [x] 4.3 Add regression coverage for degraded `show`/`update` success and degraded `verify`/`snapshot` failure paths.

## 5. Validate the change

- [x] 5.1 Run the relevant OpenSpec validation/status checks for `align-agenttk-cli-contract`.
- [x] 5.2 Run the project test suite after implementation and confirm the new CLI contract is consistent across commands.
