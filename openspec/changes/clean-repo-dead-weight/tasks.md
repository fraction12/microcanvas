## 1. Inventory and classify cleanup candidates

- [x] 1.1 Capture the current worktree and active OpenSpec changes before editing so cleanup does not overwrite unrelated work.
- [x] 1.2 Inventory tracked files across source, tests, fixtures, docs, skills, OpenSpec artifacts, generated output, package metadata, and project metadata.
- [x] 1.3 Run reference checks for candidate dead code, stale docs, unused fixtures, obsolete generated files, and package-only leftovers.
- [x] 1.4 Classify each cleanup candidate as keep, remove, relocate, or document with a short evidence note.

## 2. Remove confirmed dead weight

- [x] 2.1 Remove orphaned generated artifacts that are not produced from current source, including stale `dist/` files such as `dist/core/results.js` if still present.
- [x] 2.2 Remove or relocate obsolete top-level planning docs after preserving any still-relevant decisions in OpenSpec or public docs.
- [x] 2.3 Remove unused fixtures, helper scripts, exports, or source files only when tests, references, and package checks show they are unsupported.
- [x] 2.4 Update references after removals so README, OpenSpec artifacts, skills, tests, and package metadata do not point at deleted files.

## 3. Tighten packaging and generated-output hygiene

- [x] 3.1 Add or update a clean build path so generated output cannot retain files from previous builds.
- [x] 3.2 Add or document a package dry-run verification step that confirms tarball contents are intentional.
- [x] 3.3 Adjust package metadata, ignore rules, or files allowlists so unsupported internals, runtime state, tests, caches, and internal planning artifacts are not published.
- [x] 3.4 Confirm the package still includes required runtime output, README, license, package metadata, and supported agent skill assets.

## 4. Improve open-source-facing repository hygiene

- [x] 4.1 Add lightweight GitHub issue and pull request templates or equivalent contributor guidance for public collaboration.
- [x] 4.2 Clarify `SECURITY.md` with the intended private reporting contact path or a documented placeholder that must be resolved before wider announcement.
- [x] 4.3 Ensure `CONTRIBUTING.md` and README point contributors at the canonical validation commands and OpenSpec workflow.
- [x] 4.4 Add CI or equivalent documented checks for TypeScript validation, JS tests, package dry run, and Swift viewer tests where practical.

## 5. Validate and document the cleanup

- [x] 5.1 Run `npm run check`.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Run Swift viewer tests when practical and document any environment limitations.
- [x] 5.4 Run `npm pack --dry-run` and confirm no stale or unsupported files are included.
- [x] 5.5 Validate `clean-repo-dead-weight` with OpenSpec.
- [x] 5.6 Summarize removed items, intentionally retained items, verification results, and any follow-up cleanup candidates.
