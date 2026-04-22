import Foundation
import SwiftUI
import AppKit

struct RuntimeState: Decodable {
    let activeSurfaceId: String?
    let viewerOpen: Bool
    let updatedAt: String
}

struct SurfaceManifest: Decodable {
    let surfaceId: String
    let title: String
    let contentType: String
    let entryPath: String
    let createdAt: String
    let updatedAt: String
    let sourceKind: String
    let renderMode: String
}

struct ViewerState: Codable {
    let pid: Int32
    let lastSeenAt: String
    let activeSurfaceId: String?
}

struct SnapshotRequest: Decodable {
    let type: String
    let requestId: String
    let snapshotPath: String
    let surfaceId: String
    let requestedAt: String
    let expectedViewerPid: Int32?
}

struct SnapshotResponse: Encodable {
    let requestId: String
    let ok: Bool
    let snapshotPath: String?
    let captureState: String?
    let warning: String?
    let error: String?
    let completedAt: String
}

@MainActor
final class ViewerModel: ObservableObject {
    @Published var manifest: SurfaceManifest?
    @Published var activeURL: URL?
    @Published var pendingManifest: SurfaceManifest?
    @Published var pendingURL: URL?
    @Published var statusText: String = "No active surface"
    @Published var loadFailureMessage: String?
    @Published private(set) var readiness = ViewerReadinessCoordinator()

    private let fileManager = FileManager.default
    private var timer: Timer?
    private var lastSeenUpdatedAt: String?
    private var lastSnapshotRequestId: String?
    private let repoRootOverride: URL?
    private let lastGoodSurfaceStore = LastGoodSurfaceStore()

    var overlayMessage: String? {
        readiness.overlayMessage
    }

    var presentation: ViewerPresentation {
        ViewerPresentation(
            manifest: manifest,
            activeURL: activeURL,
            statusText: statusText,
            loadFailureMessage: loadFailureMessage
        )
    }

    init(repoRootOverride: URL? = ViewerModel.resolveRepoRootOverride()) {
        self.repoRootOverride = repoRootOverride
    }

    func startPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.pollRuntimeState()
            }
        }
        writeViewerState()
    }

    func stopPolling() {
        timer?.invalidate()
        timer = nil
        removeViewerState()
    }

    func reload() {
        do {
            let repoRoot = try locateRepoRoot()
            let runtimeRoot = repoRoot.appendingPathComponent("runtime", isDirectory: true)
            let manifestURL = runtimeRoot
                .appendingPathComponent("active", isDirectory: true)
                .appendingPathComponent("manifest.json", isDirectory: false)

            guard fileManager.fileExists(atPath: manifestURL.path) else {
                if !holdCurrentPresentation("Holding last surface")
                    && !restoreLastGoodSurfaceIfPossible(in: runtimeRoot) {
                    manifest = nil
                    activeURL = nil
                    pendingManifest = nil
                    pendingURL = nil
                    loadFailureMessage = nil
                    readiness = ViewerReadinessCoordinator()
                    statusText = "No active surface"
                }
                writeViewerState()
                return
            }

            let data = try Data(contentsOf: manifestURL)
            let decoded = try JSONDecoder().decode(SurfaceManifest.self, from: data)
            let resolvedURL = runtimeRoot
                .appendingPathComponent("active", isDirectory: true)
                .appendingPathComponent(decoded.entryPath, isDirectory: false)
            if !fileManager.fileExists(atPath: resolvedURL.path) {
                if !holdCurrentPresentation("Holding last surface")
                    && !restoreLastGoodSurfaceIfPossible(in: runtimeRoot) {
                    manifest = decoded
                    activeURL = nil
                    pendingManifest = nil
                    pendingURL = nil
                    loadFailureMessage = nil
                    readiness = ViewerReadinessCoordinator()
                    statusText = "Active surface entry is missing"
                }
                writeViewerState()
                return
            }
            let shouldStageWKWebReload = decoded.renderMode == "wkwebview"
                && manifest?.renderMode == "wkwebview"
                && activeURL != nil

            loadFailureMessage = nil
            if shouldStageWKWebReload {
                pendingManifest = decoded
                pendingURL = resolvedURL
                readiness.beginReload(surfaceId: decoded.surfaceId, revision: decoded.updatedAt)
                statusText = "Updating \(decoded.title)"
            } else {
                manifest = decoded
                activeURL = resolvedURL
                pendingManifest = nil
                pendingURL = nil
                if decoded.renderMode == "wkwebview" {
                    readiness.beginReload(surfaceId: decoded.surfaceId, revision: decoded.updatedAt)
                    statusText = "Loading \(decoded.title)"
                } else {
                    readiness = ViewerReadinessCoordinator()
                    statusText = decoded.title
                    persistPresentedSurface(in: runtimeRoot)
                }
            }
            writeViewerState()
        } catch {
            if !holdCurrentPresentation("Viewer error", loadFailureMessage: error.localizedDescription) {
                manifest = nil
                activeURL = nil
                pendingManifest = nil
                pendingURL = nil
                readiness = ViewerReadinessCoordinator()
                statusText = "Viewer error"
                loadFailureMessage = error.localizedDescription
            }
            writeViewerState()
        }
    }

    func handleWebSurfaceReady(surfaceId: String, revision: String) -> Bool {
        guard readiness.didPresentReadySurface(surfaceId: surfaceId, revision: revision) else {
            return false
        }

        if let pendingManifest,
           let pendingURL,
           pendingManifest.surfaceId == surfaceId,
           pendingManifest.updatedAt == revision {
            manifest = pendingManifest
            activeURL = pendingURL
            self.pendingManifest = nil
            self.pendingURL = nil
        }

        loadFailureMessage = nil
        statusText = manifest?.title ?? "Surface ready"
        persistPresentedSurface()
        writeViewerState()
        return true
    }

    func handleWebSurfaceLoadFailure(surfaceId: String, revision: String, description: String) {
        guard let pendingManifest,
              pendingManifest.surfaceId == surfaceId,
              pendingManifest.updatedAt == revision else {
            return
        }

        _ = holdCurrentPresentation(
            "Failed to load updated surface: \(description)",
            loadFailureMessage: description
        )
        writeViewerState()
    }

    private func holdCurrentPresentation(_ message: String, loadFailureMessage: String? = nil) -> Bool {
        guard let manifest, activeURL != nil else {
            return false
        }

        pendingManifest = nil
        pendingURL = nil
        reseedReadinessForCurrentSurface(manifest: manifest)
        statusText = message
        self.loadFailureMessage = loadFailureMessage
        return true
    }

    private func restoreLastGoodSurfaceIfPossible(in runtimeRoot: URL) -> Bool {
        guard manifest == nil, activeURL == nil else {
            return false
        }

        guard let record = try? lastGoodSurfaceStore.loadRecoverableRecord(in: runtimeRoot) else {
            return false
        }

        let restoredManifest = SurfaceManifest(
            surfaceId: record.surfaceId,
            title: record.title,
            contentType: Self.contentType(for: record.renderMode),
            entryPath: URL(fileURLWithPath: record.artifactPath).lastPathComponent,
            createdAt: record.updatedAt,
            updatedAt: record.updatedAt,
            sourceKind: "restored",
            renderMode: record.renderMode
        )
        manifest = restoredManifest
        activeURL = URL(fileURLWithPath: record.artifactPath, isDirectory: false)
        pendingManifest = nil
        pendingURL = nil
        if restoredManifest.renderMode == "wkwebview" {
            readiness.beginReload(surfaceId: restoredManifest.surfaceId, revision: restoredManifest.updatedAt)
        } else {
            readiness = ViewerReadinessCoordinator()
            persistPresentedSurface(in: runtimeRoot)
        }
        statusText = "Holding last surface"
        loadFailureMessage = nil
        return true
    }

    private func persistPresentedSurface(in runtimeRoot: URL? = nil) {
        guard let manifest, let activeURL else {
            return
        }

        let resolvedRuntimeRoot: URL
        do {
            if let runtimeRoot {
                resolvedRuntimeRoot = runtimeRoot
            } else {
                resolvedRuntimeRoot = try locateRepoRoot().appendingPathComponent("runtime", isDirectory: true)
            }

            try lastGoodSurfaceStore.save(
                LastGoodSurfaceRecord(
                    surfaceId: manifest.surfaceId,
                    title: manifest.title,
                    renderMode: manifest.renderMode,
                    updatedAt: manifest.updatedAt,
                    artifactPath: activeURL.path
                ),
                in: resolvedRuntimeRoot
            )
        } catch {
            return
        }
    }

    private func reseedReadinessForCurrentSurface(manifest: SurfaceManifest) {
        guard manifest.renderMode == "wkwebview" else {
            readiness = ViewerReadinessCoordinator()
            return
        }

        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: manifest.surfaceId, revision: manifest.updatedAt)
        _ = coordinator.didPresentReadySurface(surfaceId: manifest.surfaceId, revision: manifest.updatedAt)
        readiness = coordinator
    }

    private func pollRuntimeState() {
        do {
            let repoRoot = try locateRepoRoot()
            let runtimeRoot = repoRoot.appendingPathComponent("runtime", isDirectory: true)
            let stateURL = runtimeRoot.appendingPathComponent("state.json", isDirectory: false)

            guard fileManager.fileExists(atPath: stateURL.path) else {
                writeViewerState()
                tryHandleSnapshotRequest(in: runtimeRoot)
                return
            }

            let data = try Data(contentsOf: stateURL)
            let state = try JSONDecoder().decode(RuntimeState.self, from: data)
            if state.updatedAt != lastSeenUpdatedAt {
                lastSeenUpdatedAt = state.updatedAt
                reload()
            } else {
                writeViewerState()
            }
            tryHandleSnapshotRequest(in: runtimeRoot)
        } catch {
            statusText = "Failed to poll runtime state: \(error.localizedDescription)"
            writeViewerState()
        }
    }

    private func tryHandleSnapshotRequest(in runtimeRoot: URL) {
        let requestURL = runtimeRoot.appendingPathComponent("viewer-request.json", isDirectory: false)
        let responseURL = runtimeRoot.appendingPathComponent("viewer-response.json", isDirectory: false)
        guard fileManager.fileExists(atPath: requestURL.path) else {
            return
        }

        do {
            let data = try Data(contentsOf: requestURL)
            let request = try JSONDecoder().decode(SnapshotRequest.self, from: data)
            guard request.type == "snapshot" else {
                return
            }
            if let expectedViewerPid = request.expectedViewerPid,
               expectedViewerPid != ProcessInfo.processInfo.processIdentifier {
                return
            }
            guard request.requestId != lastSnapshotRequestId else {
                return
            }
            lastSnapshotRequestId = request.requestId
        } catch {
            let fallback = SnapshotResponse(
                requestId: lastSnapshotRequestId ?? "unknown",
                ok: false,
                snapshotPath: nil,
                captureState: nil,
                warning: nil,
                error: error.localizedDescription,
                completedAt: ISO8601DateFormatter().string(from: Date())
            )
            if let responseData = try? JSONEncoder().encode(fallback) {
                try? responseData.write(to: responseURL)
            }
            return
        }

        Task { @MainActor in
            let response = await self.snapshotResponse(for: runtimeRoot)
            if let responseData = try? JSONEncoder().encode(response) {
                try? responseData.write(to: responseURL)
            }
        }
    }

    private func snapshotResponse(for runtimeRoot: URL) async -> SnapshotResponse {
        let requestURL = runtimeRoot.appendingPathComponent("viewer-request.json", isDirectory: false)

        do {
            let data = try Data(contentsOf: requestURL)
            let request = try JSONDecoder().decode(SnapshotRequest.self, from: data)

            guard let window = AppDelegate.sharedWindow else {
                return SnapshotResponse(
                    requestId: request.requestId,
                    ok: false,
                    snapshotPath: nil,
                    captureState: nil,
                    warning: nil,
                    error: "viewer window is unavailable",
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            }

            let outcome = await waitForSnapshotOutcome(surfaceId: request.surfaceId)
            let snapshotURL = URL(fileURLWithPath: request.snapshotPath, isDirectory: false)

            switch outcome {
            case .failedNoVisibleFrame:
                return SnapshotResponse(
                    requestId: request.requestId,
                    ok: false,
                    snapshotPath: nil,
                    captureState: nil,
                    warning: nil,
                    error: "viewer has no visible frame to capture",
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            case .fresh:
                try fileManager.createDirectory(at: snapshotURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try capture(window: window, to: snapshotURL)
                return SnapshotResponse(
                    requestId: request.requestId,
                    ok: true,
                    snapshotPath: snapshotURL.path,
                    captureState: "fresh",
                    warning: nil,
                    error: nil,
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            case .degraded(let warning):
                try fileManager.createDirectory(at: snapshotURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try capture(window: window, to: snapshotURL)
                return SnapshotResponse(
                    requestId: request.requestId,
                    ok: true,
                    snapshotPath: snapshotURL.path,
                    captureState: "degraded",
                    warning: warning,
                    error: nil,
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            }
        } catch {
            return SnapshotResponse(
                requestId: lastSnapshotRequestId ?? "unknown",
                ok: false,
                snapshotPath: nil,
                captureState: nil,
                warning: nil,
                error: error.localizedDescription,
                completedAt: ISO8601DateFormatter().string(from: Date())
            )
        }
    }

    private func waitForSnapshotOutcome(surfaceId: String) async -> ViewerReadinessCoordinator.SnapshotOutcome {
        if manifest?.renderMode != "wkwebview" {
            return activeURL == nil ? .failedNoVisibleFrame : .fresh
        }

        if let immediate = readiness.immediateSnapshotOutcome(for: surfaceId) {
            return immediate
        }

        let timeoutNs: UInt64 = 2_000_000_000
        let stepNs: UInt64 = 100_000_000
        var elapsedNs: UInt64 = 0

        while elapsedNs < timeoutNs {
            try? await Task.sleep(nanoseconds: stepNs)
            elapsedNs += stepNs

            if let immediate = readiness.immediateSnapshotOutcome(for: surfaceId) {
                return immediate
            }
        }

        return readiness.markTimedOutSnapshot()
    }

    private func capture(window: NSWindow, to url: URL) throws {
        let windowID = CGWindowID(window.windowNumber)
        let bounds = window.frame
        guard let cgImage = CGWindowListCreateImage(
            bounds,
            .optionIncludingWindow,
            windowID,
            [.boundsIgnoreFraming, .bestResolution]
        ) else {
            throw NSError(domain: "MicrocanvasViewer", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to capture window image for snapshot"])
        }

        let image = NSBitmapImageRep(cgImage: cgImage)
        guard let pngData = image.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "MicrocanvasViewer", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unable to encode snapshot as PNG"])
        }
        try pngData.write(to: url)
    }

    private func writeViewerState() {
        do {
            let repoRoot = try locateRepoRoot()
            let runtimeRoot = repoRoot.appendingPathComponent("runtime", isDirectory: true)
            try fileManager.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)
            let viewerStateURL = runtimeRoot.appendingPathComponent("viewer-state.json", isDirectory: false)
            let state = ViewerState(
                pid: ProcessInfo.processInfo.processIdentifier,
                lastSeenAt: ISO8601DateFormatter().string(from: Date()),
                activeSurfaceId: manifest?.surfaceId
            )
            let data = try JSONEncoder().encode(state)
            try data.write(to: viewerStateURL)
        } catch {
            statusText = "Failed to write viewer state: \(error.localizedDescription)"
        }
    }

    private func removeViewerState() {
        do {
            let repoRoot = try locateRepoRoot()
            let viewerStateURL = repoRoot
                .appendingPathComponent("runtime", isDirectory: true)
                .appendingPathComponent("viewer-state.json", isDirectory: false)
            if fileManager.fileExists(atPath: viewerStateURL.path) {
                try fileManager.removeItem(at: viewerStateURL)
            }
        } catch {
            statusText = "Failed to remove viewer state: \(error.localizedDescription)"
        }
    }

    private func locateRepoRoot() throws -> URL {
        if let repoRootOverride {
            return repoRootOverride
        }

        var current = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
        while true {
            let packagePath = current.appendingPathComponent("package.json").path
            let gitPath = current.appendingPathComponent(".git").path
            if fileManager.fileExists(atPath: packagePath) || fileManager.fileExists(atPath: gitPath) {
                return current
            }
            let parent = current.deletingLastPathComponent()
            if parent.path == current.path {
                throw NSError(domain: "MicrocanvasViewer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to locate repo root"])
            }
            current = parent
        }
    }

    private static func resolveRepoRootOverride() -> URL? {
        let arguments = CommandLine.arguments
        guard let index = arguments.firstIndex(of: "--repo-root"), arguments.indices.contains(index + 1) else {
            return nil
        }
        return URL(fileURLWithPath: arguments[index + 1], isDirectory: true)
    }

    private static func contentType(for renderMode: String) -> String {
        switch renderMode {
        case "wkwebview":
            return "text/html"
        case "pdf":
            return "application/pdf"
        case "image":
            return "image/*"
        default:
            return "application/octet-stream"
        }
    }
}
