# Persist Last Good Viewer Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the last successfully presented viewer surface visible and restorable until newer content is actually ready, while replacing deprecated whole-window snapshot capture with supported surface-aware snapshotting.

**Architecture:** Keep the viewer state model narrow by introducing a small native persistence helper for the last-good surface and a separate presented-surface snapshotter. `ViewerModel` remains the policy owner for hold vs promote decisions, while `SurfaceView` only supplies view-specific readiness and presented `WKWebView` references for snapshotting.

**Tech Stack:** TypeScript, Node test runner, Swift 6, SwiftUI, WebKit, PDFKit, Swift Package Manager

---

## File Structure

- Create: `apps/macos-viewer/MicrocanvasViewer/Sources/LastGoodSurfaceStore.swift`
  Native persistence helper for saving and restoring the last promoted surface record.
- Create: `apps/macos-viewer/MicrocanvasViewer/Sources/PresentedSurfaceSnapshotter.swift`
  Native snapshot helper for `wkwebview`, image, and PDF presented surfaces.
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/LastGoodSurfaceStoreTests.swift`
  Unit tests for last-good save/load and fail-closed restore behavior.
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerModelStickyPresentationTests.swift`
  Unit tests for restore-on-launch and hold-on-missing/failed-update behavior.
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/PresentedSurfaceSnapshotterTests.swift`
  Unit tests for image/PDF snapshot writing and degraded web snapshot plumbing via injection.
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
  Add last-good restore/persist flow, sticky hold policy, and surface-aware snapshot integration.
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`
  Register the currently presented `WKWebView` with `ViewerModel` so snapshots target the promoted view.
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ContentView.swift`
  Continue rendering the active surface body while status text indicates hold behavior rather than placeholder fallback.
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift`
  Keep active-surface chrome accurate when the viewer is holding prior content.
- Modify: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerPresentationTests.swift`
  Cover hold-state subtitles without regressing existing placeholder behavior.
- Modify: `test/cli.test.mjs`
  Keep degraded snapshot regression coverage honest when the native viewer is holding prior content.
- Modify: `src/viewer/snapshot.ts`
  Keep the snapshot handshake contract aligned if warning text changes.
- Modify: `src/cli/commands/snapshot.ts`
  Preserve degraded CLI result output for held-last-good capture semantics.

### Task 1: Add native last-good persistence

**Files:**
- Create: `apps/macos-viewer/MicrocanvasViewer/Sources/LastGoodSurfaceStore.swift`
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/LastGoodSurfaceStoreTests.swift`

- [ ] **Step 1: Write the failing store tests**

```swift
import XCTest
@testable import MicrocanvasViewer

final class LastGoodSurfaceStoreTests: XCTestCase {
    func testSaveAndLoadRoundTripsRecoverableRecord() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let artifactURL = runtimeRoot.appendingPathComponent("active/index.html", isDirectory: false)
        try FileManager.default.createDirectory(at: artifactURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("<html></html>".utf8).write(to: artifactURL)

        let store = LastGoodSurfaceStore()
        let record = LastGoodSurfaceRecord(
            surfaceId: "surface-1",
            title: "Sticky Preview",
            renderMode: "wkwebview",
            updatedAt: "2026-04-21T20:10:00Z",
            artifactPath: artifactURL.path
        )

        try store.save(record, in: runtimeRoot)
        let loaded = try store.loadRecoverableRecord(in: runtimeRoot)

        XCTAssertEqual(loaded, record)
    }

    func testLoadRecoverableRecordReturnsNilWhenArtifactIsMissing() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let store = LastGoodSurfaceStore()
        let record = LastGoodSurfaceRecord(
            surfaceId: "surface-2",
            title: "Missing Preview",
            renderMode: "image",
            updatedAt: "2026-04-21T20:15:00Z",
            artifactPath: runtimeRoot.appendingPathComponent("missing.png").path
        )

        try store.save(record, in: runtimeRoot)
        XCTAssertNil(try store.loadRecoverableRecord(in: runtimeRoot))
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter LastGoodSurfaceStoreTests
```

Expected: FAIL because `LastGoodSurfaceStore` and `LastGoodSurfaceRecord` do not exist yet.

- [ ] **Step 3: Write the minimal persistence implementation**

```swift
import Foundation

struct LastGoodSurfaceRecord: Codable, Equatable {
    let surfaceId: String
    let title: String
    let renderMode: String
    let updatedAt: String
    let artifactPath: String
}

struct LastGoodSurfaceStore {
    private let fileName = "last-good-surface.json"
    private let fileManager = FileManager.default

    func save(_ record: LastGoodSurfaceRecord, in runtimeRoot: URL) throws {
        try fileManager.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)
        let url = runtimeRoot.appendingPathComponent(fileName, isDirectory: false)
        let data = try JSONEncoder().encode(record)
        try data.write(to: url)
    }

    func loadRecoverableRecord(in runtimeRoot: URL) throws -> LastGoodSurfaceRecord? {
        let url = runtimeRoot.appendingPathComponent(fileName, isDirectory: false)
        guard fileManager.fileExists(atPath: url.path) else { return nil }

        let data = try Data(contentsOf: url)
        let record = try JSONDecoder().decode(LastGoodSurfaceRecord.self, from: data)
        guard fileManager.fileExists(atPath: record.artifactPath) else { return nil }
        return record
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter LastGoodSurfaceStoreTests
```

Expected: PASS for both save/load tests.

- [ ] **Step 5: Commit**

```bash
git add apps/macos-viewer/MicrocanvasViewer/Sources/LastGoodSurfaceStore.swift \
  apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/LastGoodSurfaceStoreTests.swift
git commit -m "test: add last-good surface persistence store"
```

### Task 2: Make viewer presentation sticky and restorable

**Files:**
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift`
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ContentView.swift`
- Modify: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerPresentationTests.swift`
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerModelStickyPresentationTests.swift`

- [ ] **Step 1: Write failing sticky-presentation tests**

```swift
import XCTest
@testable import MicrocanvasViewer

@MainActor
final class ViewerModelStickyPresentationTests: XCTestCase {
    func testReloadRestoresLastGoodSurfaceWhenRuntimeIsEmpty() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let artifactURL = runtimeRoot.appendingPathComponent("active/index.html", isDirectory: false)
        try FileManager.default.createDirectory(at: artifactURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("<html>persisted</html>".utf8).write(to: artifactURL)
        try LastGoodSurfaceStore().save(
            LastGoodSurfaceRecord(
                surfaceId: "surface-1",
                title: "Persisted Surface",
                renderMode: "wkwebview",
                updatedAt: "2026-04-21T20:20:00Z",
                artifactPath: artifactURL.path
            ),
            in: runtimeRoot
        )

        let model = ViewerModel(repoRootOverride: root)
        model.reload()

        XCTAssertEqual(model.manifest?.title, "Persisted Surface")
        XCTAssertEqual(model.activeURL?.path, artifactURL.path)
        XCTAssertEqual(model.statusText, "Holding last surface")
    }

    func testMissingNewContentDoesNotEvictCurrentPresentedSurface() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let activeRoot = runtimeRoot.appendingPathComponent("active", isDirectory: true)
        try FileManager.default.createDirectory(at: activeRoot, withIntermediateDirectories: true)

        let initialEntry = activeRoot.appendingPathComponent("index.html", isDirectory: false)
        try Data("<html>ready</html>".utf8).write(to: initialEntry)
        try Data("""
        {"surfaceId":"surface-1","title":"Ready Surface","contentType":"text/html","entryPath":"index.html","createdAt":"2026-04-21T20:00:00Z","updatedAt":"2026-04-21T20:00:00Z","sourceKind":"generated","renderMode":"wkwebview"}
        """.utf8).write(to: activeRoot.appendingPathComponent("manifest.json", isDirectory: false))

        let model = ViewerModel(repoRootOverride: root)
        model.reload()

        try FileManager.default.removeItem(at: initialEntry)
        model.reload()

        XCTAssertEqual(model.manifest?.title, "Ready Surface")
        XCTAssertEqual(model.statusText, "Holding last surface")
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter ViewerModelStickyPresentationTests
```

Expected: FAIL because `ViewerModel.reload()` currently clears `manifest` and `activeURL` on empty or missing runtime state.

- [ ] **Step 3: Implement last-good restore and hold behavior**

```swift
private let lastGoodSurfaceStore = LastGoodSurfaceStore()

private func holdCurrentPresentation(_ message: String) {
    guard manifest != nil, activeURL != nil else {
        return
    }

    pendingManifest = nil
    pendingURL = nil
    loadFailureMessage = nil
    readiness = ViewerReadinessCoordinator()
    statusText = message
}

private func restoreLastGoodSurfaceIfPossible(in runtimeRoot: URL) {
    guard manifest == nil, activeURL == nil else { return }
    guard let record = try? lastGoodSurfaceStore.loadRecoverableRecord(in: runtimeRoot) else { return }

    manifest = SurfaceManifest(
        surfaceId: record.surfaceId,
        title: record.title,
        contentType: "application/octet-stream",
        entryPath: URL(fileURLWithPath: record.artifactPath).lastPathComponent,
        createdAt: record.updatedAt,
        updatedAt: record.updatedAt,
        sourceKind: "restored",
        renderMode: record.renderMode
    )
    activeURL = URL(fileURLWithPath: record.artifactPath, isDirectory: false)
    statusText = "Holding last surface"
}

private func persistPresentedSurface() {
    guard let manifest, let activeURL else { return }
    try? lastGoodSurfaceStore.save(
        LastGoodSurfaceRecord(
            surfaceId: manifest.surfaceId,
            title: manifest.title,
            renderMode: manifest.renderMode,
            updatedAt: manifest.updatedAt,
            artifactPath: activeURL.path
        ),
        in: try locateRepoRoot().appendingPathComponent("runtime", isDirectory: true)
    )
}
```

Implementation notes:
- Call `restoreLastGoodSurfaceIfPossible(in:)` before falling back to the no-active placeholder path.
- Replace branches that currently clear the canvas on missing/failed runtime content with `holdCurrentPresentation("Holding last surface")` when a last good surface already exists.
- Call `persistPresentedSurface()` whenever a surface becomes the promoted/current surface, including restored-first-launch success and `handleWebSurfaceReady(...)`.
- Extend `ViewerPresentationTests` with a hold-state case that still renders `.surface` while the subtitle changes to a hold message.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter ViewerModelStickyPresentationTests
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter ViewerPresentationTests
```

Expected: PASS for restore/hold behavior and existing presentation expectations.

- [ ] **Step 5: Commit**

```bash
git add apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift \
  apps/macos-viewer/MicrocanvasViewer/Sources/ViewerPresentation.swift \
  apps/macos-viewer/MicrocanvasViewer/Sources/ContentView.swift \
  apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerModelStickyPresentationTests.swift \
  apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/ViewerPresentationTests.swift
git commit -m "feat: keep last good viewer surface visible"
```

### Task 3: Replace whole-window capture with surface-aware snapshotting

**Files:**
- Create: `apps/macos-viewer/MicrocanvasViewer/Sources/PresentedSurfaceSnapshotter.swift`
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift`
- Modify: `apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift`
- Create: `apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/PresentedSurfaceSnapshotterTests.swift`

- [ ] **Step 1: Write failing snapshotter tests**

```swift
import XCTest
import AppKit
@testable import MicrocanvasViewer

final class PresentedSurfaceSnapshotterTests: XCTestCase {
    func testSnapshotImageSurfaceWritesPNG() async throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        let imageURL = root.appendingPathComponent("sample.png", isDirectory: false)
        let image = NSImage(size: NSSize(width: 32, height: 32))
        image.lockFocus()
        NSColor.red.setFill()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: 32, height: 32)).fill()
        image.unlockFocus()
        let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
        try rep.representation(using: .png, properties: [:])!.write(to: imageURL)

        let destination = root.appendingPathComponent("snapshot.png", isDirectory: false)
        let snapshotter = PresentedSurfaceSnapshotter()

        try await snapshotter.capture(
            surface: .image(url: imageURL),
            to: destination
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: destination.path))
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter PresentedSurfaceSnapshotterTests
```

Expected: FAIL because `PresentedSurfaceSnapshotter` and the `capture(surface:to:)` API do not exist yet.

- [ ] **Step 3: Implement the snapshotter and remove deprecated window capture**

```swift
import AppKit
import PDFKit
import WebKit

enum PresentedSurface {
    case webView(WKWebView)
    case image(url: URL)
    case pdf(url: URL)
}

struct PresentedSurfaceSnapshotter {
    func capture(surface: PresentedSurface, to destination: URL) async throws {
        switch surface {
        case .webView(let webView):
            let image = try await webView.takeSnapshot(configuration: nil)
            try writePNG(image, to: destination)
        case .image(let url):
            guard let image = NSImage(contentsOf: url) else {
                throw NSError(domain: "MicrocanvasViewer", code: 10, userInfo: [NSLocalizedDescriptionKey: "Unable to load image surface"])
            }
            try writePNG(image, to: destination)
        case .pdf(let url):
            guard let document = PDFDocument(url: url), let page = document.page(at: 0) else {
                throw NSError(domain: "MicrocanvasViewer", code: 11, userInfo: [NSLocalizedDescriptionKey: "Unable to load PDF surface"])
            }
            let bounds = page.bounds(for: .mediaBox)
            let image = NSImage(size: bounds.size)
            image.lockFocus()
            NSColor.windowBackgroundColor.setFill()
            bounds.fill()
            page.draw(with: .mediaBox, to: NSGraphicsContext.current!.cgContext)
            image.unlockFocus()
            try writePNG(image, to: destination)
        }
    }

    private func writePNG(_ image: NSImage, to destination: URL) throws {
        guard
            let tiff = image.tiffRepresentation,
            let rep = NSBitmapImageRep(data: tiff),
            let png = rep.representation(using: .png, properties: [:])
        else {
            throw NSError(domain: "MicrocanvasViewer", code: 12, userInfo: [NSLocalizedDescriptionKey: "Unable to encode snapshot as PNG"])
        }
        try png.write(to: destination)
    }
}
```

```swift
// ViewerModel.swift
private let snapshotter = PresentedSurfaceSnapshotter()
private weak var presentedWebView: WKWebView?

func updatePresentedWebView(_ webView: WKWebView?, surfaceId: String, revision: String) {
    guard manifest?.surfaceId == surfaceId, manifest?.updatedAt == revision else { return }
    presentedWebView = webView
}

private func capturePresentedSurface(to url: URL) async throws {
    guard let manifest, let activeURL else {
        throw NSError(domain: "MicrocanvasViewer", code: 13, userInfo: [NSLocalizedDescriptionKey: "viewer has no visible frame to capture"])
    }

    let surface: PresentedSurface
    switch manifest.renderMode {
    case "wkwebview":
        guard let presentedWebView else {
            throw NSError(domain: "MicrocanvasViewer", code: 14, userInfo: [NSLocalizedDescriptionKey: "viewer has no presented web surface to capture"])
        }
        surface = .webView(presentedWebView)
    case "image":
        surface = .image(url: activeURL)
    case "pdf":
        surface = .pdf(url: activeURL)
    default:
        throw NSError(domain: "MicrocanvasViewer", code: 15, userInfo: [NSLocalizedDescriptionKey: "unsupported presented surface for snapshot"])
    }

    try await snapshotter.capture(surface: surface, to: url)
}
```

```swift
// SurfaceView.swift
let onPresentedWebViewChanged: (WKWebView?, String, String) -> Void

if webView == loadingWebView, let loadingTarget {
    if onReady(loadingTarget.surfaceId, loadingTarget.revision) {
        promoteLoadingWebView()
        onPresentedWebViewChanged(visibleWebView, loadingTarget.surfaceId, loadingTarget.revision)
    }
}
```

Implementation notes:
- Delete the old `capture(window:to:)` helper and all `CGWindowListCreateImage(...)` usage from `ViewerModel.swift`.
- Call `capturePresentedSurface(to:)` from `snapshotResponse(for:)` for both `fresh` and `degraded` outcomes.
- Keep `ViewerReadinessCoordinator` as the freshness policy owner; the snapshotter only captures the currently presented surface.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter PresentedSurfaceSnapshotterTests
cd apps/macos-viewer/MicrocanvasViewer && swift test --filter ViewerReadinessCoordinatorTests
```

Expected: PASS, and `ViewerModel.swift` no longer emits a deprecation warning for `CGWindowListCreateImage`.

- [ ] **Step 5: Commit**

```bash
git add apps/macos-viewer/MicrocanvasViewer/Sources/PresentedSurfaceSnapshotter.swift \
  apps/macos-viewer/MicrocanvasViewer/Sources/ViewerModel.swift \
  apps/macos-viewer/MicrocanvasViewer/Sources/SurfaceView.swift \
  apps/macos-viewer/MicrocanvasViewer/Tests/MicrocanvasViewerTests/PresentedSurfaceSnapshotterTests.swift
git commit -m "feat: snapshot presented viewer surfaces directly"
```

### Task 4: Preserve honest degraded CLI behavior and validate end to end

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `src/viewer/snapshot.ts`
- Modify: `src/cli/commands/snapshot.ts`
- Modify: `openspec/changes/persist-last-good-viewer-surface/tasks.md`

- [ ] **Step 1: Add the failing degraded-warning regression test**

```js
test('snapshot surfaces degraded warning when native viewer is holding prior content', async () => {
  const shown = await runCli(['show', insideFile]);
  const shownRecord = expectSuccess(shown);

  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shownRecord.surfaceId
  });

  const pending = runCli(['snapshot']);

  let request;
  for (let i = 0; i < 20; i += 1) {
    if (fs.existsSync(viewerRequestFile)) {
      request = JSON.parse(fs.readFileSync(viewerRequestFile, 'utf8'));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.ok(request);
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    captureState: 'degraded',
    warning: 'Snapshot captured from held last good content while newer content was not ready.',
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshot = await pending;
  assert.equal(snapshot.verificationStatus, 'unverified');
  assert.match((snapshot.warnings ?? []).join('\n'), /held last good content/i);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
```bash
npm run build && node --test --test-name-pattern "holding prior content" test/cli.test.mjs
```

Expected: FAIL until the warning text and result handling are aligned with the held-last-good semantics.

- [ ] **Step 3: Update CLI result wording and validation tracking**

```ts
// src/cli/commands/snapshot.ts
message: degraded
  ? 'snapshot captured, but newer content was not ready and the viewer held the last good surface'
  : 'snapshot captured',
warnings: degraded
  ? [snapshot.warning ?? 'Snapshot captured from held last good content while newer content was not ready.']
  : undefined
```

```md
## 4. Verification

- [x] 4.1 Add native tests for last-good persistence and restore behavior.
- [x] 4.2 Add native tests for sticky promotion policy and hold behavior.
- [x] 4.3 Add CLI regression coverage for degraded snapshots captured from held last-good content.
- [x] 4.4 Run manual native-viewer smoke for hold-on-clear, relaunch-restore, and surface-aware snapshot capture.
```

- [ ] **Step 4: Run the full verification suite**

Run:
```bash
npm test
cd apps/macos-viewer/MicrocanvasViewer && swift test
openspec validate persist-last-good-viewer-surface --strict
```

Expected:
- `npm test` exits 0
- `swift test` exits 0
- `openspec validate persist-last-good-viewer-surface --strict` reports the change is valid

Manual smoke:

```bash
npm run build
node dist/cli/index.js show test/fixtures/inside.md --json
sleep 1
node dist/cli/index.js show test/fixtures/viewer-wide-table.csv --json
sleep 1
pkill -f 'MicrocanvasViewer/.build/.*/MicrocanvasViewer' || true
node dist/cli/index.js show test/fixtures/test-image.jpg --json
sleep 1
node dist/cli/index.js snapshot --json
```

Expected manual outcomes:
- the viewer keeps the first visual visible until the second one is genuinely ready
- after viewer relaunch, the last good surface restores if its artifact still exists
- snapshot artifacts reflect the presented surface rather than a whole-window grab

- [ ] **Step 5: Commit**

```bash
git add test/cli.test.mjs \
  src/viewer/snapshot.ts \
  src/cli/commands/snapshot.ts \
  openspec/changes/persist-last-good-viewer-surface/tasks.md
git commit -m "test: validate sticky viewer persistence flow"
```
