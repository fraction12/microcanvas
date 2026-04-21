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
}

struct SnapshotResponse: Encodable {
    let requestId: String
    let ok: Bool
    let snapshotPath: String?
    let error: String?
    let completedAt: String
}

@MainActor
final class ViewerModel: ObservableObject {
    @Published var manifest: SurfaceManifest?
    @Published var activeURL: URL?
    @Published var statusText: String = "No active surface"

    private let fileManager = FileManager.default
    private var timer: Timer?
    private var lastSeenUpdatedAt: String?
    private var lastSnapshotRequestId: String?
    private let repoRootOverride: URL?

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
                manifest = nil
                activeURL = nil
                statusText = "No active surface"
                writeViewerState()
                return
            }

            let data = try Data(contentsOf: manifestURL)
            let decoded = try JSONDecoder().decode(SurfaceManifest.self, from: data)
            manifest = decoded
            activeURL = runtimeRoot
                .appendingPathComponent("active", isDirectory: true)
                .appendingPathComponent(decoded.entryPath, isDirectory: false)
            statusText = decoded.title
            writeViewerState()
        } catch {
            manifest = nil
            activeURL = nil
            statusText = "Failed to load active surface: \(error.localizedDescription)"
            writeViewerState()
        }
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
            guard request.requestId != lastSnapshotRequestId else {
                return
            }
            lastSnapshotRequestId = request.requestId

            let response: SnapshotResponse
            if let window = AppDelegate.sharedWindow {
                let snapshotURL = URL(fileURLWithPath: request.snapshotPath, isDirectory: false)
                try fileManager.createDirectory(at: snapshotURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try capture(window: window, to: snapshotURL)
                response = SnapshotResponse(
                    requestId: request.requestId,
                    ok: true,
                    snapshotPath: snapshotURL.path,
                    error: nil,
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            } else {
                response = SnapshotResponse(
                    requestId: request.requestId,
                    ok: false,
                    snapshotPath: nil,
                    error: "viewer window is unavailable",
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            }

            let responseData = try JSONEncoder().encode(response)
            try responseData.write(to: responseURL)
        } catch {
            let fallback = SnapshotResponse(
                requestId: lastSnapshotRequestId ?? "unknown",
                ok: false,
                snapshotPath: nil,
                error: error.localizedDescription,
                completedAt: ISO8601DateFormatter().string(from: Date())
            )
            if let responseData = try? JSONEncoder().encode(fallback) {
                try? responseData.write(to: responseURL)
            }
        }
    }

    private func capture(window: NSWindow, to url: URL) throws {
        guard let image = window.contentView?.bitmapImageRepForCachingDisplay(in: window.contentView?.bounds ?? .zero) else {
            throw NSError(domain: "MicrocanvasViewer", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to allocate bitmap for snapshot"])
        }
        window.contentView?.cacheDisplay(in: window.contentView?.bounds ?? .zero, to: image)
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
}
