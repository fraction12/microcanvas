# Cleanup Report

## Worktree And Active Changes

Captured before cleanup edits:

- Modified user/work-in-progress files were present in README, package metadata, `src/core/surface.ts`, JS tests, and macOS viewer snapshot files.
- Untracked active changes included `openspec/changes/clean-repo-dead-weight/`, `openspec/changes/fix-web-snapshot-export-fidelity/`, and `test/fixtures/sample-diagram.mmd`.
- Active OpenSpec changes were `clean-repo-dead-weight`, `fix-web-snapshot-export-fidelity`, `allow-external-source-ingest`, `harden-local-surface-security`, `align-agenttk-cli-contract`, and `expand-supported-surfaces`.
- Completed OpenSpec changes `persist-last-good-viewer-surface` and `polish-viewer-experience` were intentionally preserved for a later OpenSpec archive pass.

## Classification Notes

| Candidate | Decision | Evidence |
| --- | --- | --- |
| `dist/core/results.js` | remove | No `src/core/results.ts` source owner exists; a clean build no longer emits the file; package dry run no longer includes it. |
| `dist/` | keep with guardrails | Tests import built output and the npm package intentionally includes runtime `dist/**`; `npm run build` now cleans before compiling. |
| `IMPLEMENTATION-PLAN.md` | relocate | The top-level bootstrap plan referenced stale early structure and `src/core/results.ts`; it now lives under `docs/internal/` with a historical note. |
| `docs/superpowers/**` | relocate | Agent planning notes are useful history but not contributor-first docs; they now live under `docs/internal/superpowers/`. |
| Active OpenSpec changes | keep | In-progress changes must be preserved and coordinated through OpenSpec instead of removed during cleanup. |
| `align-agenttk-cli-contract` references to `src/core/results.ts` | document | Those references belong to an active change whose tasks explicitly include removing or repurposing the old result contract. |
| Test fixtures | keep | Existing fixtures are used by JS tests or manual viewer/snapshot workflows; `sample-diagram.mmd` is active untracked Mermaid work and was preserved. |
| `skills/microcanvas-present/**` | keep | README, package metadata, and install scripts intentionally support the agent skill assets as package contents. |
| `.agents/`, `.codex/`, `.cursor/`, runtime state, Swift `.build/` | exclude from package | These are ignored/generated local state, not tracked package contents. |

## Removed Or Relocated

- Removed stale generated package output by clean-building `dist/`, which eliminated `dist/core/results.js`.
- Relocated `IMPLEMENTATION-PLAN.md` to `docs/internal/bootstrap-implementation-plan.md`.
- Relocated `docs/superpowers/plans/2026-04-21-cli-pretty-pass.md` to `docs/internal/superpowers/plans/2026-04-21-cli-pretty-pass.md`.
- Relocated `docs/superpowers/specs/2026-04-21-cli-pretty-pass-design.md` to `docs/internal/superpowers/specs/2026-04-21-cli-pretty-pass-design.md`.

## Intentionally Retained

- Active OpenSpec changes and untracked user work.
- Supported package files: README, LICENSE, package metadata, source-owned `dist/**`, and `skills/microcanvas-present/**`.
- Existing test fixtures and macOS viewer tests.
- Completed OpenSpec changes, pending an explicit archive workflow.

## Follow-Up Candidates

- Replace the placeholder security-contact process with a real private reporting route before wider public announcement.
- Archive completed OpenSpec changes through the OpenSpec archive workflow.
- Decide whether manual smoke fixtures like `test/fixtures/viewer-wide-table.csv` and `test/fixtures/tall-snapshot.*` should gain documentation or be removed in a later cleanup.
