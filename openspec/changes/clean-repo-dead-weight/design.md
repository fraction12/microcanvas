## Context

Microcanvas is still small, but the repo now has several overlapping streams: active OpenSpec changes, TypeScript CLI/runtime code, a macOS Swift viewer, published npm package contents, agent skills, docs, fixtures, and generated `dist/` output. A cleanup pass has to reduce weight without turning into a rewrite or accidentally deleting artifacts that belong to active work.

The first audit already found one concrete packaging issue: `npm pack --dry-run` includes `dist/core/results.js` even though the source file no longer exists. That is exactly the kind of dead weight this change should catch and prevent. Other candidates need evidence before deletion because some exported helpers are tested through built output, some docs record active design context, and some stale-looking files are part of current OpenSpec changes.

## Goals / Non-Goals

**Goals:**
- Remove stale generated files, obsolete docs, dead fixtures, unused helper code, and unsupported package contents when evidence shows they are no longer part of the supported project.
- Make the package contents and repository tree easy for outside contributors to understand.
- Add lightweight guardrails so dead generated files and accidental package leaks are caught by repeatable checks.
- Preserve active OpenSpec work, user edits, and supported public behavior unless the cleanup task explicitly updates the relevant spec and tests.
- Leave the repo in a state where `npm run check`, `npm test`, Swift viewer tests, OpenSpec validation, and a package dry run are credible release-readiness signals.

**Non-Goals:**
- No runtime feature work or supported-format expansion.
- No broad architectural rewrite of the CLI, renderer, viewer, or agent skill.
- No silent compatibility break for documented CLI behavior.
- No mass deletion of active OpenSpec changes just because they are unfinished.
- No replacement of the existing security hardening or snapshot-fidelity work.

## Decisions

### 1. Classify before deleting

Every cleanup candidate will be placed in one of four buckets:

- keep: currently used, documented, tested, or intentionally part of an active change
- remove: no source owner, no references, no supported contract, or generated stale output
- relocate: useful internal context that does not belong in the top-level contributor path
- document: intentional surface that looked dead but should be explained

Alternatives considered:
- Delete anything not referenced by the compiler. Rejected because tests import built output, OpenSpec artifacts are intentionally not in the TypeScript graph, and docs/fixtures can be product-critical.
- Only remove the known orphaned `dist` file. Rejected because it fixes the symptom but not the repository-readiness problem.

### 2. Treat generated output and package contents as first-class cleanup surfaces

The npm package should be checked with a dry run after build cleanup. Generated `dist/` contents must line up with current `src/` output, and stale files must not ship merely because they were left behind by a previous build. If needed, add a clean-build step or package verification script rather than relying on manual deletion.

Alternatives considered:
- Stop tracking or publishing `dist/` immediately. Rejected for this cleanup spec because packaging strategy may be a separate release decision.
- Keep current packaging and rely on reviewers. Rejected because the current dry run already proves reviewers can miss generated leftovers.

### 3. Keep OpenSpec as the source of cleanup scope

OpenSpec changes may be cleaned up only through explicit tasks: archive completed work, update stale references, or mark superseded changes intentionally. Active changes that are unrelated to this cleanup remain out of scope, even if their files make the tree look busier.

Alternatives considered:
- Delete all complete or old change directories. Rejected because archived and active specs provide context and may be required by the workflow.
- Fold cleanup into existing changes. Rejected because repo-readiness cuts across package, docs, tests, and metadata, and it needs its own reviewable checklist.

### 4. Add small project-hygiene guardrails

Open-source readiness here means making the repo understandable and hard to accidentally dirty again. The likely guardrails are:

- a repeatable package dry-run check
- a generated-output cleanup or clean build path
- CI that runs the standard TypeScript and test checks
- contributor-facing templates or docs only where they reduce ambiguity

Alternatives considered:
- Add a large contributor process framework. Rejected because Microcanvas should stay light.
- Avoid adding any process files. Rejected because open-source contributors need obvious paths for issues, PRs, and security reports.

## Risks / Trade-offs

- [Accidentally deleting useful context] -> Require evidence and classify candidates before removal; relocate ambiguous docs before deleting them.
- [Breaking consumers that import unsupported internals] -> Only preserve documented/public CLI behavior; call out unsupported internal removals in docs or release notes if needed.
- [Conflicting with active work] -> Start from `git status` and `openspec list`; avoid editing active change files unless the cleanup explicitly coordinates with that change.
- [Cleanup growing into feature work] -> Keep tasks anchored to dead-weight removal, packaging hygiene, and contributor readiness.
- [Checks becoming too slow or brittle] -> Prefer existing `npm run check`, `npm test`, Swift tests, OpenSpec validation, and `npm pack --dry-run` over new heavyweight tooling.

## Migration Plan

1. Inventory tracked files, generated outputs, package contents, exported helpers, fixtures, docs, and OpenSpec changes.
2. Classify cleanup candidates into keep/remove/relocate/document.
3. Remove or relocate only the items with clear evidence, beginning with stale generated/package artifacts.
4. Add minimal scripts, docs, or CI checks that prevent the same dead weight from returning.
5. Update docs to reflect the cleaned repository shape and any intentionally unsupported internal imports.
6. Run validation: TypeScript check, JS tests, Swift viewer tests when practical, OpenSpec validation, and npm package dry run.

Rollback for removals is normal git revert. If a candidate is ambiguous during implementation, keep it and document the follow-up rather than deleting speculatively.

## Open Questions

- Should `dist/` remain tracked for this package long term, or should release/publish builds generate it outside source control?
- Which private security contact should be published in `SECURITY.md` before a wider open-source push?
- Should older internal planning docs move under `docs/internal/`, be archived under OpenSpec, or be removed after their decisions are captured?
