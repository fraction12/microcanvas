# Viewer Polish Implementation Plan

Status: completed on 2026-04-21

## Goal

Ship the `polish-viewer-experience` change without expanding Microcanvas into a heavier workspace product. The implementation needed to improve presentation polish, empty and error states, and reload/snapshot confidence while keeping the runtime contract small and deterministic.

## Final implementation shape

### 1. Surface presentation polish

- `src/core/surface.ts`
  - Wrap generated HTML-like surfaces in a deliberate presentation shell instead of exposing raw document output.
  - Improve table spacing, overflow framing, and explicit readable light-theme colors.
- `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`
  - Present images inside a framed canvas treatment.
  - Keep PDF rendering visually quiet and aligned with the native window background.
- `apps/macos-viewer/MicrocanvasViewer/Sources/ContentView.swift`
  - Render a lightweight header with title, surface type badge, and updated timestamp without overpowering the surface.
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift`
  - Centralize presentation decisions for active content, metadata chrome, and placeholders.

### 2. Intentional empty, missing, and error states

- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift`
  - Provide explicit placeholder models for:
    - no active surface
    - missing active entry artifact
    - viewer error
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
  - Track `statusText` and `loadFailureMessage` so the native UI can distinguish loading, missing, and failure cases cleanly.
- `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerPresentationTests.swift`
  - Cover placeholder and metadata rendering behavior.

### 3. Readiness-driven `WKWebView` reloads

- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerReadinessCoordinator.swift`
  - Introduce a small, unit-testable readiness state machine for `idle`, `loading`, `ready`, and `degraded`.
  - Track the last ready frame and pending reload revision.
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
  - Stage `WKWebView` reloads through `pendingManifest` and `pendingURL`.
  - Keep the last ready surface visible while refreshed content loads.
  - Distinguish fresh, degraded, and no-visible-frame snapshot outcomes.
- `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`
  - Feed `WKNavigationDelegate` events into the readiness coordinator and only promote replacement content when the new revision is actually ready.
- `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerReadinessCoordinatorTests.swift`
  - Verify ready, loading, degraded, and no-visible-frame transitions.

### 4. Honest snapshot reporting and test isolation

- `src/viewer/snapshot.ts`
  - Return structured snapshot results with `captureState` and optional `warning`.
- `src/cli/commands/snapshot.ts`
  - Surface degraded captures honestly in both JSON and human-readable output.
- `src/viewer/state.ts`
  - Optionally constrain accepted native viewer heartbeats with `MICROCANVAS_NATIVE_VIEWER_PID` so test runs ignore unrelated live viewer processes.
- `src/viewer/launch.ts`
  - Respect `MICROCANVAS_DISABLE_NATIVE_VIEWER=1` during CLI tests.
- `test/cli.test.mjs`
  - Cover fresh and degraded snapshot responses and keep viewer-backed tests isolated from a real native app session.

### 5. Native snapshot fidelity fix discovered during smoke testing

- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
  - Switch the native snapshot path from view-cache capture to compositor-aware whole-window capture so visible `WKWebView` content is included in the PNG artifact.
- Residual follow-up
  - The current CoreGraphics window capture API is deprecated on macOS 14. It is acceptable for this change because it restored truthful viewer-backed snapshots, but it should be revisited in a follow-up once a replacement path is ready.

## Artifact inventory

### OpenSpec artifacts

- `openspec/changes/polish-viewer-experience/proposal.md`
- `openspec/changes/polish-viewer-experience/design.md`
- `openspec/changes/polish-viewer-experience/specs/runtime-model/spec.md`
- `openspec/changes/polish-viewer-experience/tasks.md`
- `openspec/changes/polish-viewer-experience/implementation-plan.md`

### TypeScript and CLI artifacts

- `src/core/surface.ts`
- `src/viewer/launch.ts`
- `src/viewer/snapshot.ts`
- `src/viewer/state.ts`
- `src/cli/commands/snapshot.ts`
- `test/cli.test.mjs`
- `test/fixtures/viewer-wide-table.csv`

### Native viewer artifacts

- `apps/macos-viewer/MicrocanvasViewer/Package.swift`
- `apps/macos-viewer/MicrocanvasViewer/Sources/ContentView.swift`
- `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift`
- `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerReadinessCoordinator.swift`
- `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerPresentationTests.swift`
- `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerReadinessCoordinatorTests.swift`

## Execution checklist

- [x] Improve image and table presentation paths.
- [x] Add deliberate HTML-like surface framing instead of raw document presentation.
- [x] Add no-active-surface, missing-entry, and viewer-error placeholder states.
- [x] Introduce lightweight metadata chrome for active surfaces.
- [x] Add a native `WKWebView` readiness coordinator and staged reload path.
- [x] Keep the last ready frame visible during `WKWebView` refresh.
- [x] Extend snapshot responses with fresh vs degraded capture metadata.
- [x] Add automated regression coverage in Node and Swift.
- [x] Isolate CLI tests from live native viewer sessions.
- [x] Fix native snapshot fidelity after manual smoke testing exposed blank `WKWebView` captures.
- [x] Validate the OpenSpec change and rerun live viewer smoke with tracked fixtures.

## Validation

### Automated verification

Completed during implementation:

- `npm run check`
- `npm test`
- `cd apps/macos-viewer/MicrocanvasViewer && swift test`
- `openspec validate polish-viewer-experience --strict`

### Manual native viewer smoke

Fixtures:

- `test/fixtures/viewer-wide-table.csv`
- `test/fixtures/test-image.jpg`

Commands:

```bash
npm run build
node dist/cli/index.js show test/fixtures/viewer-wide-table.csv --json
sleep 1
node dist/cli/index.js snapshot --json
node dist/cli/index.js show test/fixtures/test-image.jpg --json
sleep 1
node dist/cli/index.js snapshot --json
```

Observed results on 2026-04-21:

- The wide-table surface renders inside the new framed shell with readable text and visible viewer chrome.
- The image surface renders inside the framed image presentation path without awkward raw-file styling.
- Native snapshot PNG output now contains the visible `WKWebView` content instead of blank or black captures.
- When freshness cannot be guaranteed, the snapshot contract still reports degraded results or clear failure instead of overstating success.

## Follow-up notes

- Revisit the CoreGraphics whole-window capture path when replacing deprecated macOS 14 APIs becomes practical.
- Keep future polish work inside the existing small-product boundary. Do not treat this change as a wedge toward heavy workspace or editor chrome.
