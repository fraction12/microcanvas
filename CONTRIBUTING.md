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
npm run build
npm run check
npm test
```

## What Makes A Good Change

- user-visible behavior is clear
- command output stays stable and tool-friendly
- supported-format handling stays explicit
- degraded and native viewer behavior remain easy to reason about
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
