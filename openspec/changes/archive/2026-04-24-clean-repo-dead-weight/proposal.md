## Why

Microcanvas has accumulated early-stage scaffolding, generated leftovers, and internal planning artifacts while the runtime has been moving quickly. Before widening open-source use, the repository needs a deliberate cleanup pass so contributors see a small, intentional project rather than stale contracts, packaged dead files, and ambiguous internal notes.

## What Changes

- Remove stale generated artifacts and package leaks that no longer have a source owner, starting with obsolete `dist/` output such as the orphaned `dist/core/results.js`.
- Audit exported helpers, CLI modules, viewer code, fixtures, docs, and tracked planning files for dead code or stale content, then remove or relocate only items with clear evidence that they are no longer part of the product contract.
- Tighten npm packaging and repository hygiene so published contents contain only runtime assets, docs, license files, and agent skill assets that are intentionally supported.
- Add or refresh open-source-facing project hygiene where it directly supports cleanup clarity, such as contributor guidance, security contact expectations, CI/package checks, and issue/PR templates.
- Preserve active OpenSpec work and user changes unless a cleanup task explicitly archives, updates, or supersedes them through the OpenSpec process.

## Capabilities

### New Capabilities
- `repository-maintenance`: Defines how the project keeps its source tree, published package contents, generated artifacts, docs, tests, and contributor-facing metadata intentional and free of dead weight.

### Modified Capabilities
- `transport-integration`: CLI/package distribution requirements will explicitly exclude stale generated contract artifacts and keep the published command surface aligned with the current AgentTK-native runtime contract.

## Impact

- Affected areas: package metadata and pack output, `dist/` generation/cleanup behavior, repository docs, GitHub/project hygiene files, tests or scripts used to verify dead-weight cleanup, and any clearly unused source/test fixtures discovered during audit.
- API surface: no runtime behavior changes are intended, but removing stale files from published packages may break consumers that imported unsupported internals.
- Dependencies/systems: no new runtime dependencies are expected; CI or packaging scripts may be added or tightened to keep the repository clean over time.
- Coordination: this change should account for active changes such as `align-agenttk-cli-contract`, `fix-web-snapshot-export-fidelity`, and `harden-local-surface-security` rather than racing or reverting their work.
