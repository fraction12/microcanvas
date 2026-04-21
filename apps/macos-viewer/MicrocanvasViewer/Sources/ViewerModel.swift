import Foundation
import SwiftUI

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

@MainActor
final class ViewerModel: ObservableObject {
    @Published var manifest: SurfaceManifest?
    @Published var activeURL: URL?
    @Published var statusText: String = "No active surface"

    private let fileManager = FileManager.default
    private var timer: Timer?
    private var lastSeenUpdatedAt: String?

    func startPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.pollRuntimeState()
            }
        }
    }

    func stopPolling() {
        timer?.invalidate()
        timer = nil
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
                return
            }

            let data = try Data(contentsOf: manifestURL)
            let decoded = try JSONDecoder().decode(SurfaceManifest.self, from: data)
            manifest = decoded
            activeURL = runtimeRoot
                .appendingPathComponent("active", isDirectory: true)
                .appendingPathComponent(decoded.entryPath, isDirectory: false)
            statusText = decoded.title
        } catch {
            manifest = nil
            activeURL = nil
            statusText = "Failed to load active surface: \(error.localizedDescription)"
        }
    }

    private func pollRuntimeState() {
        do {
            let repoRoot = try locateRepoRoot()
            let stateURL = repoRoot
                .appendingPathComponent("runtime", isDirectory: true)
                .appendingPathComponent("state.json", isDirectory: false)

            guard fileManager.fileExists(atPath: stateURL.path) else {
                return
            }

            let data = try Data(contentsOf: stateURL)
            let state = try JSONDecoder().decode(RuntimeState.self, from: data)
            if state.updatedAt != lastSeenUpdatedAt {
                lastSeenUpdatedAt = state.updatedAt
                reload()
            }
        } catch {
            statusText = "Failed to poll runtime state: \(error.localizedDescription)"
        }
    }

    private func locateRepoRoot() throws -> URL {
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
}
