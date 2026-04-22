import Foundation
import XCTest
@testable import MicrocanvasViewer

final class LastGoodSurfaceStoreTests: XCTestCase {
    func testSaveAndLoadRoundTripsRecoverableRecord() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let artifactURL = runtimeRoot.appendingPathComponent("active/index.html", isDirectory: false)
        try FileManager.default.createDirectory(
            at: artifactURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
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

    func testLoadRecoverableRecordReturnsNilWhenPersistedFileIsMissing() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let store = LastGoodSurfaceStore()

        XCTAssertNil(try store.loadRecoverableRecord(in: runtimeRoot))
    }

    func testLoadRecoverableRecordReturnsNilWhenPersistedFileIsMalformed() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let malformedURL = runtimeRoot.appendingPathComponent("last-good-surface.json", isDirectory: false)
        try Data("{\"surfaceId\":".utf8).write(to: malformedURL)

        let store = LastGoodSurfaceStore()

        XCTAssertNil(try store.loadRecoverableRecord(in: runtimeRoot))
    }
}
