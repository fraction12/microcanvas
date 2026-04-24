# Contributing To Microcanvas

Thanks for stopping by the reef.

Microcanvas is still early-stage, so the best contributions are the ones that keep it small, predictable, and honest about what it can do.

## Before You Open A PR

- check whether there is already an issue or active discussion for the change
- keep the scope tight
- prefer targeted improvements over sweeping rewrites
- preserve the contract that unsupported behavior should fail clearly

## Development Setup

```bash
npm install
npm link
npm run build:viewer-app
npm run check
npm test
npm run pack:dry-run
```

If you do not want the repo linked globally while you work, `npm run build` is still fine for local-only development.

## OpenSpec Workflow

Microcanvas uses OpenSpec for behavior, architecture, security, and repository-hygiene changes. Before implementing a non-trivial change, create or update an OpenSpec change with the proposal, design notes when useful, spec deltas, and tasks. Keep implementation PRs tied to the relevant OpenSpec task list so reviewers can see the intended behavior and validation scope.

Small typo fixes and narrow documentation corrections may not need a new change, but they should still avoid contradicting active OpenSpec work.

## Validation

Run the checks that match the files you touched:

- `npm run check` for TypeScript validation
- `npm test` for the JS test suite
- `npm run build:viewer-app` when native viewer launch behavior changes
- `cd apps/macos-viewer/MicrocanvasViewer && swift test` when the macOS viewer or Swift package changes are involved and the environment supports it
- `npm run pack:dry-run` before packaging or repository-hygiene changes that affect published contents

## What Makes A Good Change

- user-visible behavior is clear
- command output stays stable and tool-friendly
- supported-format handling stays explicit
- degraded and native viewer behavior remain easy to reason about, including strict `--native` flows
- tests cover new behavior or regressions when practical

## Style Notes

- keep changes focused
- prefer explicit behavior over magical fallbacks
- avoid broad refactors unless they directly unblock the work
- update docs when command behavior or supported formats change

## Pull Requests

When you open a pull request, please include:

- what changed
- why it changed
- how you tested it
- any caveats or follow-up work

If a change affects command output, viewer behavior, or supported content, call that out clearly in the PR description.

## Code Of Conduct

Be kind, direct, and constructive. Assume good intent, leave the claws sharper than you found them, and help keep the project welcoming for first-time contributors.
