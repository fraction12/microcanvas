# Microcanvas Implementation Plan

Last updated: 2026-04-21

## Goal

Start Microcanvas with a real, minimal vertical slice that matches the current OpenSpec:
- macOS-first native viewer
- AgentTK CLI
- canonical surface root/state model
- single active surface with write locking
- minimal `render`, `show`, and `status` path

## Recommended build order

### Phase 1: Repo skeleton and state model
Create the runtime and CLI skeleton before attempting a polished viewer.

Deliverables:
- package/tooling scaffold for AgentTK CLI
- runtime module for canonical surface-root paths
- state/lock helpers
- surface manifest types
- `status` command returning machine-readable output

### Phase 2: Minimal render/show path
Implement the smallest useful happy path.

Deliverables:
- `render` writes staged surface payload
- `show` promotes staged payload into `active/`
- basic manifest generation
- lock enforcement for mutating commands
- viewer launch hook invoked from `show`

### Phase 3: Native viewer skeleton
Build the smallest macOS viewer that can prove the contract.

Deliverables:
- single-window macOS app
- lightweight HTML-like rendering path
- load active surface from manifest/entry path
- reload when `show` updates the active surface

### Phase 4: Snapshot/verify/update
Only after the vertical slice works.

## Recommended file layout

```text
microcanvas/
  README.md
  IMPLEMENTATION-PLAN.md
  openspec/
  package.json
  tsconfig.json
  src/
    cli/
      index.ts
      commands/
        render.ts
        show.ts
        status.ts
    core/
      paths.ts
      state.ts
      lock.ts
      manifest.ts
      surface.ts
      results.ts
    viewer/
      launch.ts
  runtime/
    .gitkeep
  apps/
    macos-viewer/
      MicrocanvasViewer.xcodeproj
      MicrocanvasViewer/
        App.swift
        ContentView.swift
        SurfaceWebView.swift
```

## Canonical runtime model to implement first

Surface root under repo-local runtime path for now:

```text
runtime/
  state.json
  lock.json
  active/
    manifest.json
    index.html
    assets/
  staging/
  snapshots/
```

## First command scope

### `microcanvas status`
Implement first because it is the cheapest real proof of the runtime model.

Should return JSON like:

```json
{
  "ok": true,
  "code": "OK",
  "message": "runtime state loaded",
  "surfaceId": null,
  "viewer": { "open": false },
  "lock": { "held": false },
  "artifacts": {}
}
```

### `microcanvas render`
Initial version:
- accept a source file path or direct artifact path
- create staged surface directory
- create manifest.json
- copy or materialize a basic entry artifact into staging
- return staged artifact details

### `microcanvas show`
Initial version:
- acquire write lock
- ensure staged candidate exists or create one
- atomically replace `runtime/active/`
- update `state.json`
- launch or notify viewer
- release lock

## Immediate first coding step

Build the TypeScript CLI/runtime skeleton first, not the macOS app.

Order:
1. `package.json`
2. `tsconfig.json`
3. `src/core/{paths,state,lock,manifest,results}.ts`
4. `src/cli/index.ts`
5. `src/cli/commands/status.ts`
6. `src/cli/commands/render.ts`
7. `src/cli/commands/show.ts`
8. stub `src/viewer/launch.ts`

That gives a testable CLI before the viewer exists.

## Recommended technical choices

- TypeScript for CLI/runtime core
- AgentTK for command surface
- JSON files for v1 runtime metadata
- atomic directory swap where practical for active surface promotion
- repo-local runtime root until a better app-state location is intentionally chosen

## Honest constraints

- The spec is clear enough to start the CLI/runtime now.
- The exact AgentTK package/API still needs to be confirmed during implementation.
- The macOS viewer can begin as a thin shell after the CLI/runtime contract is working.

## Recommended next step

Create the CLI/runtime scaffold and land a working `microcanvas status` command first. That is the fastest path to proving the architecture without getting trapped in viewer polish too early.
