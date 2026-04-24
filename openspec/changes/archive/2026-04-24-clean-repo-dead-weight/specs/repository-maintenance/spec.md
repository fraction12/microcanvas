## ADDED Requirements

### Requirement: Keep tracked repository contents intentional
The project SHALL maintain tracked source, docs, tests, fixtures, OpenSpec artifacts, generated output, and project metadata as intentional repository contents with a clear owner or purpose.

#### Scenario: Cleanup candidate is reviewed
- **WHEN** a tracked file, fixture, helper, script, generated artifact, or document appears unused or obsolete
- **THEN** the maintainer classifies it as keep, remove, relocate, or document before changing it
- **AND** the decision is based on evidence such as references, tests, package contents, OpenSpec status, public docs, or active worktree state

#### Scenario: Ambiguous candidate is found
- **WHEN** a cleanup candidate might still support active OpenSpec work, user edits, release history, tests, or documented behavior
- **THEN** the project keeps or documents it instead of deleting it speculatively

### Requirement: Exclude stale generated artifacts from supported outputs
The project SHALL prevent stale generated files from remaining in tracked or published outputs when their source owner no longer exists.

#### Scenario: Generated output has no source owner
- **WHEN** a generated file is present in `dist/` or another generated-output directory
- **AND** the current build no longer produces that file from tracked source
- **THEN** the stale generated file is removed from the repository or excluded from supported package output

#### Scenario: Build output is refreshed
- **WHEN** generated output is rebuilt for release or validation
- **THEN** the generated directory reflects the current source tree without preserving unrelated leftover files from prior builds

### Requirement: Keep package contents minimal and supported
The project SHALL publish only intentionally supported runtime files, documentation, license metadata, package metadata, and agent-skill assets.

#### Scenario: Package dry run is inspected
- **WHEN** maintainers run the package dry-run check
- **THEN** the tarball contents exclude local runtime state, caches, internal-only planning artifacts, orphaned generated files, tests, and unsupported implementation leftovers

#### Scenario: Unsupported internal file would be published
- **WHEN** a file would appear in the package but is not part of the supported runtime, documentation, license, package metadata, or agent-skill surface
- **THEN** packaging configuration or cleanup removes it from the published contents

### Requirement: Preserve active specification work during cleanup
The project SHALL coordinate repository cleanup with active OpenSpec changes instead of silently deleting or rewriting their artifacts.

#### Scenario: Cleanup touches OpenSpec artifacts
- **WHEN** a cleanup candidate is an OpenSpec proposal, design, task list, spec delta, archive entry, or file referenced from those artifacts
- **THEN** maintainers check the change status and either preserve it, archive it through the OpenSpec workflow, or update the relevant OpenSpec artifact intentionally

#### Scenario: Active change owns stale-looking code
- **WHEN** code or docs look obsolete but are part of an in-progress OpenSpec change
- **THEN** cleanup work does not remove them unless the owning change is updated or superseded in the same reviewable scope

### Requirement: Provide contributor-facing hygiene for open-source readiness
The project SHALL include lightweight contributor-facing metadata that makes cleanup expectations, contribution flow, security reporting, and validation commands discoverable.

#### Scenario: New contributor inspects the repository
- **WHEN** a contributor opens the project
- **THEN** they can find the expected development checks, contribution expectations, security-reporting path, and issue or pull-request guidance without reading internal planning notes

#### Scenario: Internal planning material remains useful
- **WHEN** internal planning docs are still valuable but not part of the first contributor path
- **THEN** they are relocated or documented so they do not look like current public-facing instructions
