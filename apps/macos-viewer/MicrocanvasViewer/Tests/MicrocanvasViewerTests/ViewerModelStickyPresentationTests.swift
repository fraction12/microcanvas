import XCTest
@testable import MicrocanvasViewer

@MainActor
final class ViewerModelStickyPresentationTests: XCTestCase {
    func testReloadRestoresLastGoodSurfaceWhenRuntimeIsEmpty() throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let artifactURL = runtimeRoot.appendingPathComponent("active/index.html", isDirectory: false)
        try FileManager.default.createDirectory(
            at: artifactURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
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
        XCTAssertNil(model.readiness.immediateSnapshotOutcome(for: "surface-1"))

        XCTAssertTrue(model.handleWebSurfaceReady(surfaceId: "surface-1", revision: "2026-04-21T20:20:00Z"))
        XCTAssertEqual(model.readiness.immediateSnapshotOutcome(for: "surface-1"), .fresh)
    }

    func testMissingNewContentDoesNotEvictCurrentPresentedSurface() throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let activeRoot = runtimeRoot.appendingPathComponent("active", isDirectory: true)
        try FileManager.default.createDirectory(at: activeRoot, withIntermediateDirectories: true)

        let initialEntry = activeRoot.appendingPathComponent("index.html", isDirectory: false)
        try Data("<html>ready</html>".utf8).write(to: initialEntry)
        try writeManifest(
            """
            {"surfaceId":"surface-1","title":"Ready Surface","contentType":"text/html","entryPath":"index.html","createdAt":"2026-04-21T20:00:00Z","updatedAt":"2026-04-21T20:00:00Z","sourceKind":"generated","renderMode":"wkwebview"}
            """,
            to: activeRoot
        )

        let model = ViewerModel(repoRootOverride: root)
        model.reload()

        try FileManager.default.removeItem(at: initialEntry)
        model.reload()

        XCTAssertEqual(model.manifest?.title, "Ready Surface")
        XCTAssertEqual(model.activeURL?.lastPathComponent, "index.html")
        XCTAssertEqual(model.statusText, "Holding last surface")
        XCTAssertEqual(model.readiness.immediateSnapshotOutcome(for: "surface-1"), .fresh)
    }

    func testFailedRefreshKeepsCurrentWebSurfaceCapturable() throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let activeRoot = runtimeRoot.appendingPathComponent("active", isDirectory: true)
        try FileManager.default.createDirectory(at: activeRoot, withIntermediateDirectories: true)

        let initialEntry = activeRoot.appendingPathComponent("index.html", isDirectory: false)
        try Data("<html>ready</html>".utf8).write(to: initialEntry)
        try writeManifest(
            """
            {"surfaceId":"surface-1","title":"Ready Surface","contentType":"text/html","entryPath":"index.html","createdAt":"2026-04-21T20:00:00Z","updatedAt":"2026-04-21T20:00:00Z","sourceKind":"generated","renderMode":"wkwebview"}
            """,
            to: activeRoot
        )

        let model = ViewerModel(repoRootOverride: root)
        model.reload()
        XCTAssertTrue(model.handleWebSurfaceReady(surfaceId: "surface-1", revision: "2026-04-21T20:00:00Z"))

        let refreshedEntry = activeRoot.appendingPathComponent("updated.html", isDirectory: false)
        try Data("<html>updated</html>".utf8).write(to: refreshedEntry)
        try writeManifest(
            """
            {"surfaceId":"surface-1","title":"Ready Surface","contentType":"text/html","entryPath":"updated.html","createdAt":"2026-04-21T20:00:00Z","updatedAt":"2026-04-21T20:05:00Z","sourceKind":"generated","renderMode":"wkwebview"}
            """,
            to: activeRoot
        )

        model.reload()
        model.handleWebSurfaceLoadFailure(
            surfaceId: "surface-1",
            revision: "2026-04-21T20:05:00Z",
            description: "timed out"
        )

        XCTAssertEqual(model.statusText, "Failed to load updated surface: timed out")
        XCTAssertEqual(model.activeURL?.lastPathComponent, "index.html")
        XCTAssertEqual(model.readiness.immediateSnapshotOutcome(for: "surface-1"), .fresh)
    }

    func testFreshWebLoadDoesNotPersistLastGoodUntilReady() throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        let activeRoot = runtimeRoot.appendingPathComponent("active", isDirectory: true)
        try FileManager.default.createDirectory(at: activeRoot, withIntermediateDirectories: true)

        let entry = activeRoot.appendingPathComponent("index.html", isDirectory: false)
        try Data("<html>ready</html>".utf8).write(to: entry)
        try writeManifest(
            """
            {"surfaceId":"surface-2","title":"Fresh Web Surface","contentType":"text/html","entryPath":"index.html","createdAt":"2026-04-21T20:10:00Z","updatedAt":"2026-04-21T20:10:00Z","sourceKind":"generated","renderMode":"wkwebview"}
            """,
            to: activeRoot
        )

        let store = LastGoodSurfaceStore()
        let model = ViewerModel(repoRootOverride: root)
        model.reload()

        XCTAssertNil(try store.loadRecoverableRecord(in: runtimeRoot))
        XCTAssertNil(model.readiness.immediateSnapshotOutcome(for: "surface-2"))

        XCTAssertTrue(model.handleWebSurfaceReady(surfaceId: "surface-2", revision: "2026-04-21T20:10:00Z"))

        XCTAssertEqual(
            try store.loadRecoverableRecord(in: runtimeRoot),
            LastGoodSurfaceRecord(
                surfaceId: "surface-2",
                title: "Fresh Web Surface",
                renderMode: "wkwebview",
                updatedAt: "2026-04-21T20:10:00Z",
                artifactPath: entry.path
            )
        )
        XCTAssertEqual(model.readiness.immediateSnapshotOutcome(for: "surface-2"), .fresh)
    }

    private func makeRoot() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
    }

    private func writeManifest(_ json: String, to activeRoot: URL) throws {
        try Data(json.utf8).write(
            to: activeRoot.appendingPathComponent("manifest.json", isDirectory: false)
        )
    }
}
