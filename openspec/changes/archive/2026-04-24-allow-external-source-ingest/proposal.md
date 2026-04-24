## Why

Microcanvas currently requires source files to live under the repository root before they can be rendered or shown. That is a useful early constraint for development, but it is the wrong long-term product shape.

Real users and real agents keep files wherever their workflow produces them: project repos, temporary work directories, downloads, notes folders, exports, generated scratch paths, and other locations outside the Microcanvas repo. Requiring callers to first move or rewrite those files into the repo adds friction, complicates agent flows, and makes the tool feel narrower than it needs to be.

The right model is to separate **source location** from **presentation location**.

Microcanvas should be able to accept a supported source file from anywhere the local user can read, ingest it into a Microcanvas-owned staged surface directory, and then render/show/update from that staged copy. That preserves the security posture introduced by the local-surface hardening work: the viewer still reads only staged Microcanvas-owned content, not arbitrary source-tree locations.

## What changes

This change adds an explicit external-source ingest model for supported local files:

1. Allow callers to pass supported source files from outside the Microcanvas repo root.
2. Ingest the source into a Microcanvas-owned staging area before render/show/update presentation flows.
3. Preserve the rule that the viewer reads from staged active-surface content, not from the original source path.
4. Define how updates work when the original source path changes or when a caller pushes a replacement source into the same active surface.
5. Document the security posture clearly: flexible source paths, narrow presentation paths.

## Non-goals

- No direct viewer access to arbitrary source-tree paths.
- No persistent file-sync/watch service in this pass.
- No browser-style trust model for hostile third-party content.
- No change to supported content families beyond what Microcanvas already supports.
- No multi-surface workspace or collaborative runtime semantics in this pass.

## Success criteria

- A caller can `show`, `render`, or `update` using a supported source file outside the repo root.
- Microcanvas materializes and presents only a staged copy under its own runtime-controlled directories.
- The native viewer never requires broader read access to the original source location.
- Runtime metadata makes source-versus-staged behavior understandable to tools.
- Documentation explains the ingest model clearly, including why direct arbitrary-path presentation is not the default.
- Regression tests cover external in-root and out-of-repo source paths, staged-copy behavior, and update semantics.