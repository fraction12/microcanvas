import Foundation
import SwiftUI
import AppKit
import WebKit

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

struct SnapshotRequest: Codable {
    let type: String
    let requestId: String
    let snapshotPath: String
    let surfaceId: String
    let requestedAt: String
    let expectedViewerPid: Int32?
}

struct SnapshotResponse: Codable {
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
    @Published var sourceHistory: [SourceHistoryEntry] = []
    @Published var historyPanelExpanded = false
    @Published var historyReloadMessage: String?
    @Published var historyReloadInFlightPath: String?
    @Published private(set) var readiness = ViewerReadinessCoordinator()

    private let fileManager = FileManager.default
    private var timer: Timer?
    private var lastSeenUpdatedAt: String?
    private var lastSnapshotRequestId: String?
    private let repoRootOverride: URL?
    private let lastGoodSurfaceStore = LastGoodSurfaceStore()
    private let sourceHistoryStore: SourceHistoryStore
    private let sourceHistoryReloader: SourceHistoryReloader
    private let snapshotter: PresentedSurfaceSnapshotter
    private weak var presentedWebView: WKWebView?
    private var presentedWebSurfaceId: String?
    private var presentedWebRevision: String?
    private weak var presentedSurfaceView: NSView?
    private var presentedSurfaceViewId: String?
    private var presentedSurfaceViewRevision: String?

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

    init(
        repoRootOverride: URL? = ViewerModel.resolveRepoRootOverride(),
        sourceHistoryStore: SourceHistoryStore = SourceHistoryStore(),
        sourceHistoryReloader: SourceHistoryReloader = SourceHistoryReloader(),
        snapshotter: PresentedSurfaceSnapshotter = PresentedSurfaceSnapshotter()
    ) {
        self.repoRootOverride = repoRootOverride
        self.sourceHistoryStore = sourceHistoryStore
        self.sourceHistoryReloader = sourceHistoryReloader
        self.snapshotter = snapshotter
    }

    func startPolling() {
        refreshSourceHistory()
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
        refreshSourceHistory()
        do {
            let repoRoot = try locateRepoRoot()
            let runtimeRoot = repoRoot.appendingPathComponent("runtime", isDirectory: true)
            let manifestURL = runtimeRoot
                .appendingPathComponent("active", isDirectory: true)
                .appendingPathComponent("manifest.json", isDirectory: false)

            guard fileManager.fileExists(atPath: manifestURL.path) else {
                if !holdCurrentPresentation("Holding last surface")
                    && !restoreLastGoodSurfaceIfPossible(in: runtimeRoot) {
                    clearPresentedVisualSurfaces()
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
                    clearPresentedVisualSurfaces()
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
                clearPresentedVisualSurfaces(exceptRenderMode: decoded.renderMode)
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
                    bringViewerToFront()
                }
            }
            writeViewerState()
        } catch {
            if !holdCurrentPresentation("Viewer error", loadFailureMessage: error.localizedDescription) {
                clearPresentedVisualSurfaces()
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

    func toggleHistoryPanel() {
        historyPanelExpanded.toggle()
        refreshSourceHistory()
    }

    func refreshSourceHistory() {
        sourceHistory = sourceHistoryStore.loadEntries()
    }

    func showHistoryEntry(_ entry: SourceHistoryEntry) {
        guard entry.isAvailable else {
            historyReloadMessage = "Source missing"
            return
        }

        historyReloadInFlightPath = entry.originalPath
        historyReloadMessage = "Loading \(entry.displayName)"

        Task { @MainActor in
            do {
                let repoRoot = try locateRepoRoot()
                try await sourceHistoryReloader.reload(sourcePath: entry.originalPath, repoRoot: repoRoot)
                historyReloadMessage = nil
                historyReloadInFlightPath = nil
                refreshSourceHistory()
                reload()
            } catch {
                historyReloadMessage = "Could not load source"
                historyReloadInFlightPath = nil
            }
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
        bringViewerToFront()
        writeViewerState()
        return true
    }

    func updatePresentedWebView(_ webView: WKWebView?, surfaceId: String, revision: String) {
        guard manifest?.renderMode == "wkwebview",
              manifest?.surfaceId == surfaceId,
              manifest?.updatedAt == revision else {
            return
        }

        presentedWebView = webView
        presentedWebSurfaceId = surfaceId
        presentedWebRevision = revision
    }

    func updatePresentedSurfaceView(_ view: NSView?, surfaceId: String, revision: String) {
        guard let manifest,
              manifest.renderMode == "image" || manifest.renderMode == "pdf",
              manifest.surfaceId == surfaceId,
              manifest.updatedAt == revision else {
            return
        }

        presentedSurfaceView = view
        presentedSurfaceViewId = surfaceId
        presentedSurfaceViewRevision = revision
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
            clearPresentedVisualSurfaces(exceptRenderMode: restoredManifest.renderMode)
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

    func tryHandleSnapshotRequest(in runtimeRoot: URL) {
        let requestURL = runtimeRoot.appendingPathComponent("viewer-request.json", isDirectory: false)
        let responseURL = runtimeRoot.appendingPathComponent("viewer-response.json", isDirectory: false)
        guard fileManager.fileExists(atPath: requestURL.path) else {
            return
        }

        let request: SnapshotRequest
        do {
            let data = try Data(contentsOf: requestURL)
            request = try JSONDecoder().decode(SnapshotRequest.self, from: data)
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
            let response = await self.snapshotResponse(for: request, in: runtimeRoot)
            guard self.lastSnapshotRequestId == request.requestId else {
                return
            }
            if let responseData = try? JSONEncoder().encode(response) {
                try? responseData.write(to: responseURL)
            }
        }
    }

    func snapshotResponse(for request: SnapshotRequest, in runtimeRoot: URL) async -> SnapshotResponse {
        do {
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
                try await capturePresentedSurface(to: snapshotURL)
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
                try await capturePresentedSurface(to: snapshotURL)
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
                requestId: request.requestId,
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
            return await waitForPresentedNonWebSnapshotOutcome(surfaceId: surfaceId)
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

    private func waitForPresentedNonWebSnapshotOutcome(surfaceId: String) async -> ViewerReadinessCoordinator.SnapshotOutcome {
        if let immediate = immediatePresentedNonWebSnapshotOutcome(for: surfaceId) {
            return immediate
        }

        let timeoutNs: UInt64 = 2_000_000_000
        let stepNs: UInt64 = 100_000_000
        var elapsedNs: UInt64 = 0

        while elapsedNs < timeoutNs {
            try? await Task.sleep(nanoseconds: stepNs)
            elapsedNs += stepNs

            if let immediate = immediatePresentedNonWebSnapshotOutcome(for: surfaceId) {
                return immediate
            }
        }

        return .failedNoVisibleFrame
    }

    private func immediatePresentedNonWebSnapshotOutcome(for surfaceId: String) -> ViewerReadinessCoordinator.SnapshotOutcome? {
        guard let manifest, activeURL != nil else {
            return .failedNoVisibleFrame
        }

        guard manifest.surfaceId == surfaceId else {
            return nil
        }

        switch manifest.renderMode {
        case "image", "pdf":
            return hasMatchingPresentedSurfaceView(for: manifest) ? .fresh : nil
        default:
            return .fresh
        }
    }

    private func hasMatchingPresentedSurfaceView(for manifest: SurfaceManifest) -> Bool {
        guard presentedSurfaceView != nil else {
            return false
        }

        return presentedSurfaceViewId == manifest.surfaceId
            && presentedSurfaceViewRevision == manifest.updatedAt
    }

    private func capturePresentedSurface(to url: URL) async throws {
        guard let manifest, activeURL != nil else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "viewer has no visible frame to capture"]
            )
        }

        let surface: PresentedSurface
        switch manifest.renderMode {
        case "wkwebview":
            guard let presentedWebView,
                  presentedWebSurfaceId == manifest.surfaceId,
                  presentedWebRevision == manifest.updatedAt else {
                throw NSError(
                    domain: "MicrocanvasViewer",
                    code: 3,
                    userInfo: [NSLocalizedDescriptionKey: "viewer has no presented web surface to capture"]
                )
            }
            surface = .webView(presentedWebView)
        case "image":
            guard presentedSurfaceView != nil,
                  presentedSurfaceViewId == manifest.surfaceId,
                  presentedSurfaceViewRevision == manifest.updatedAt,
                  let activeURL else {
                throw NSError(
                    domain: "MicrocanvasViewer",
                    code: 4,
                    userInfo: [NSLocalizedDescriptionKey: "viewer has no presented image surface to capture"]
                )
            }
            surface = .imageFile(activeURL)
        case "pdf":
            guard let presentedSurfaceView,
                  presentedSurfaceViewId == manifest.surfaceId,
                  presentedSurfaceViewRevision == manifest.updatedAt else {
                throw NSError(
                    domain: "MicrocanvasViewer",
                    code: 5,
                    userInfo: [NSLocalizedDescriptionKey: "viewer has no presented PDF surface to capture"]
                )
            }
            surface = .pdfView(presentedSurfaceView)
        default:
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 6,
                userInfo: [NSLocalizedDescriptionKey: "unsupported presented surface for snapshot"]
            )
        }

        try await snapshotter.capture(surface: surface, to: url)
    }

    private func clearPresentedVisualSurfaces(exceptRenderMode renderMode: String? = nil) {
        if renderMode != "wkwebview" {
            presentedWebView = nil
            presentedWebSurfaceId = nil
            presentedWebRevision = nil
        }
        if renderMode != "image" && renderMode != "pdf" {
            presentedSurfaceView = nil
            presentedSurfaceViewId = nil
            presentedSurfaceViewRevision = nil
        }
    }

    private func bringViewerToFront() {
        AppDelegate.bringViewerToFront()
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
