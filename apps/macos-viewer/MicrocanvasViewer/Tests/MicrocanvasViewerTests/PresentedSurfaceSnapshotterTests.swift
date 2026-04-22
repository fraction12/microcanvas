import XCTest
import AppKit
import WebKit
@testable import MicrocanvasViewer

@MainActor
final class PresentedSurfaceSnapshotterTests: XCTestCase {
    func testSnapshotImageSurfaceUsesPresentedViewHook() async throws {
        let root = makeRoot()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        let destination = root.appendingPathComponent("snapshot.png", isDirectory: false)
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        var capturedView: NSView?
        let snapshotter = PresentedSurfaceSnapshotter(
            capturePresentedView: { candidate in
                capturedView = candidate
                return self.makeSolidImage(color: .systemRed, size: NSSize(width: 32, height: 32))
            }
        )

        try await snapshotter.capture(surface: .imageView(view), to: destination)

        XCTAssertTrue(capturedView === view)
        XCTAssertTrue(FileManager.default.fileExists(atPath: destination.path))
        XCTAssertNotNil(NSImage(contentsOf: destination))
    }

    func testSnapshotPDFSurfaceUsesPresentedViewHook() async throws {
        let root = makeRoot()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        let destination = root.appendingPathComponent("snapshot.png", isDirectory: false)
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        var capturedView: NSView?
        let snapshotter = PresentedSurfaceSnapshotter(
            capturePresentedView: { candidate in
                capturedView = candidate
                return self.makeSolidImage(color: .systemGreen, size: NSSize(width: 32, height: 32))
            }
        )

        try await snapshotter.capture(surface: .pdfView(view), to: destination)

        XCTAssertTrue(capturedView === view)
        XCTAssertTrue(FileManager.default.fileExists(atPath: destination.path))
        XCTAssertNotNil(NSImage(contentsOf: destination))
    }

    func testSnapshotWebSurfaceUsesPresentedWebView() async throws {
        let root = makeRoot()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        let destination = root.appendingPathComponent("snapshot.png", isDirectory: false)
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        var capturedWebView: WKWebView?
        let snapshotter = PresentedSurfaceSnapshotter(
            captureWebView: { candidate in
                capturedWebView = candidate
                return self.makeSolidImage(color: .systemBlue, size: NSSize(width: 32, height: 32))
            }
        )

        try await snapshotter.capture(surface: .webView(webView), to: destination)

        XCTAssertTrue(capturedWebView === webView)
        XCTAssertTrue(FileManager.default.fileExists(atPath: destination.path))
        XCTAssertNotNil(NSImage(contentsOf: destination))
    }

    func testTryHandleSnapshotRequestCarriesDecodedRequestIntoAsyncResponse() async throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let activeURL = runtimeRoot.appendingPathComponent("active/sample.png", isDirectory: false)
        try FileManager.default.createDirectory(
            at: activeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("placeholder".utf8).write(to: activeURL)

        let gate = SnapshotGate()
        let model = ViewerModel(
            repoRootOverride: root,
            snapshotter: PresentedSurfaceSnapshotter(
                capturePresentedView: { _ in
                    await gate.wait()
                    return self.makeSolidImage(color: .systemOrange, size: NSSize(width: 32, height: 32))
                }
            )
        )
        model.manifest = SurfaceManifest(
            surfaceId: "surface-1",
            title: "Presented Image",
            contentType: "image/png",
            entryPath: "sample.png",
            createdAt: "2026-04-21T20:00:00Z",
            updatedAt: "2026-04-21T20:00:00Z",
            sourceKind: "generated",
            renderMode: "image"
        )
        model.activeURL = activeURL
        let presentedView = NSView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        model.updatePresentedSurfaceView(
            presentedView,
            surfaceId: "surface-1",
            revision: "2026-04-21T20:00:00Z"
        )

        let requestOne = SnapshotRequest(
            type: "snapshot",
            requestId: "request-1",
            snapshotPath: runtimeRoot.appendingPathComponent("snapshot-1.png", isDirectory: false).path,
            surfaceId: "surface-1",
            requestedAt: "2026-04-21T20:01:00Z",
            expectedViewerPid: nil
        )
        let requestTwo = SnapshotRequest(
            type: "snapshot",
            requestId: "request-2",
            snapshotPath: runtimeRoot.appendingPathComponent("snapshot-2.png", isDirectory: false).path,
            surfaceId: "surface-1",
            requestedAt: "2026-04-21T20:01:01Z",
            expectedViewerPid: nil
        )

        try writeRequest(requestOne, in: runtimeRoot)
        model.tryHandleSnapshotRequest(in: runtimeRoot)

        try writeRequest(requestTwo, in: runtimeRoot)
        await gate.resume()

        let response = try await waitForResponse(in: runtimeRoot)

        XCTAssertEqual(response.requestId, requestOne.requestId)
        XCTAssertEqual(response.snapshotPath, requestOne.snapshotPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: requestOne.snapshotPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: requestTwo.snapshotPath))
    }

    func testOlderSnapshotTaskCannotOverwriteLatestResponseFile() async throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let activeURL = runtimeRoot.appendingPathComponent("active/sample.png", isDirectory: false)
        try FileManager.default.createDirectory(
            at: activeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("placeholder".utf8).write(to: activeURL)

        let sequencer = OrderedCaptureSequencer()
        let model = ViewerModel(
            repoRootOverride: root,
            snapshotter: PresentedSurfaceSnapshotter(
                capturePresentedView: { _ in
                    let index = await sequencer.nextCaptureIndex()
                    let color: NSColor = index == 1 ? .systemRed : .systemBlue
                    return self.makeSolidImage(color: color, size: NSSize(width: 32, height: 32))
                }
            )
        )
        model.manifest = SurfaceManifest(
            surfaceId: "surface-1",
            title: "Presented Image",
            contentType: "image/png",
            entryPath: "sample.png",
            createdAt: "2026-04-21T20:00:00Z",
            updatedAt: "2026-04-21T20:00:00Z",
            sourceKind: "generated",
            renderMode: "image"
        )
        model.activeURL = activeURL
        let presentedView = NSView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        model.updatePresentedSurfaceView(
            presentedView,
            surfaceId: "surface-1",
            revision: "2026-04-21T20:00:00Z"
        )

        let requestOne = SnapshotRequest(
            type: "snapshot",
            requestId: "request-1",
            snapshotPath: runtimeRoot.appendingPathComponent("snapshot-1.png", isDirectory: false).path,
            surfaceId: "surface-1",
            requestedAt: "2026-04-21T20:01:00Z",
            expectedViewerPid: nil
        )
        let requestTwo = SnapshotRequest(
            type: "snapshot",
            requestId: "request-2",
            snapshotPath: runtimeRoot.appendingPathComponent("snapshot-2.png", isDirectory: false).path,
            surfaceId: "surface-1",
            requestedAt: "2026-04-21T20:01:01Z",
            expectedViewerPid: nil
        )

        try writeRequest(requestOne, in: runtimeRoot)
        model.tryHandleSnapshotRequest(in: runtimeRoot)
        await sequencer.waitUntilFirstCaptureStarts()

        try writeRequest(requestTwo, in: runtimeRoot)
        model.tryHandleSnapshotRequest(in: runtimeRoot)

        let latestResponse = try await waitForResponse(in: runtimeRoot, matchingRequestId: requestTwo.requestId)
        XCTAssertEqual(latestResponse.requestId, requestTwo.requestId)
        XCTAssertEqual(latestResponse.snapshotPath, requestTwo.snapshotPath)

        await sequencer.releaseFirstCapture()
        try await Task.sleep(nanoseconds: 200_000_000)

        let finalResponse = try readResponse(in: runtimeRoot)
        XCTAssertEqual(finalResponse.requestId, requestTwo.requestId)
        XCTAssertEqual(finalResponse.snapshotPath, requestTwo.snapshotPath)
    }

    func testNonWebSnapshotResponseWaitsForPresentedSurfaceRegistration() async throws {
        let root = makeRoot()
        let runtimeRoot = root.appendingPathComponent("runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        let activeURL = runtimeRoot.appendingPathComponent("active/sample.png", isDirectory: false)
        try FileManager.default.createDirectory(
            at: activeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("placeholder".utf8).write(to: activeURL)

        let model = ViewerModel(
            repoRootOverride: root,
            snapshotter: PresentedSurfaceSnapshotter(
                capturePresentedView: { _ in
                    self.makeSolidImage(color: .systemPurple, size: NSSize(width: 32, height: 32))
                }
            )
        )
        model.manifest = SurfaceManifest(
            surfaceId: "surface-3",
            title: "Presented Image",
            contentType: "image/png",
            entryPath: "sample.png",
            createdAt: "2026-04-21T20:00:00Z",
            updatedAt: "2026-04-21T20:00:00Z",
            sourceKind: "generated",
            renderMode: "image"
        )
        model.activeURL = activeURL

        let request = SnapshotRequest(
            type: "snapshot",
            requestId: "request-3",
            snapshotPath: runtimeRoot.appendingPathComponent("snapshot-3.png", isDirectory: false).path,
            surfaceId: "surface-3",
            requestedAt: "2026-04-21T20:01:02Z",
            expectedViewerPid: nil
        )

        let responseTask = Task { await model.snapshotResponse(for: request, in: runtimeRoot) }
        try await Task.sleep(nanoseconds: 150_000_000)

        let presentedView = NSView(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        model.updatePresentedSurfaceView(
            presentedView,
            surfaceId: "surface-3",
            revision: "2026-04-21T20:00:00Z"
        )

        let response = await responseTask.value

        XCTAssertTrue(response.ok)
        XCTAssertEqual(response.requestId, request.requestId)
        XCTAssertEqual(response.captureState, "fresh")
        XCTAssertEqual(response.snapshotPath, request.snapshotPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: request.snapshotPath))
    }

    private func makeRoot() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
    }

    private func makeSolidImage(color: NSColor, size: NSSize) -> NSImage {
        let image = NSImage(size: size)
        image.lockFocus()
        color.setFill()
        NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
        image.unlockFocus()
        return image
    }

    private func writeRequest(_ request: SnapshotRequest, in runtimeRoot: URL) throws {
        let requestURL = runtimeRoot.appendingPathComponent("viewer-request.json", isDirectory: false)
        try JSONEncoder().encode(request).write(to: requestURL)
    }

    private func waitForResponse(in runtimeRoot: URL) async throws -> SnapshotResponse {
        let responseURL = runtimeRoot.appendingPathComponent("viewer-response.json", isDirectory: false)
        let deadline = Date().addingTimeInterval(2)

        while Date() < deadline {
            if FileManager.default.fileExists(atPath: responseURL.path) {
                return try JSONDecoder().decode(SnapshotResponse.self, from: Data(contentsOf: responseURL))
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }

        XCTFail("Timed out waiting for viewer-response.json")
        throw CancellationError()
    }

    private func waitForResponse(in runtimeRoot: URL, matchingRequestId requestId: String) async throws -> SnapshotResponse {
        let deadline = Date().addingTimeInterval(2)

        while Date() < deadline {
            let response = try? readResponse(in: runtimeRoot)
            if response?.requestId == requestId {
                return response!
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }

        XCTFail("Timed out waiting for viewer-response.json for \(requestId)")
        throw CancellationError()
    }

    private func readResponse(in runtimeRoot: URL) throws -> SnapshotResponse {
        let responseURL = runtimeRoot.appendingPathComponent("viewer-response.json", isDirectory: false)
        return try JSONDecoder().decode(SnapshotResponse.self, from: Data(contentsOf: responseURL))
    }
}

private actor SnapshotGate {
    private var continuation: CheckedContinuation<Void, Never>?
    private var isOpen = false

    func wait() async {
        if isOpen {
            return
        }
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func resume() {
        isOpen = true
        continuation?.resume()
        continuation = nil
    }
}

private actor OrderedCaptureSequencer {
    private var captureIndex = 0
    private var firstStartedContinuation: CheckedContinuation<Void, Never>?
    private var firstReleaseContinuation: CheckedContinuation<Void, Never>?
    private var didStartFirstCapture = false

    func nextCaptureIndex() async -> Int {
        captureIndex += 1
        let current = captureIndex

        if current == 1 {
            didStartFirstCapture = true
            firstStartedContinuation?.resume()
            firstStartedContinuation = nil
            await withCheckedContinuation { continuation in
                firstReleaseContinuation = continuation
            }
        }

        return current
    }

    func waitUntilFirstCaptureStarts() async {
        if didStartFirstCapture {
            return
        }
        await withCheckedContinuation { continuation in
            firstStartedContinuation = continuation
        }
    }

    func releaseFirstCapture() {
        firstReleaseContinuation?.resume()
        firstReleaseContinuation = nil
    }
}
