struct ViewerReadinessCoordinator: Equatable {
    struct PendingReload: Equatable {
        let surfaceId: String
        let revision: String
    }

    enum Phase: Equatable {
        case idle
        case loading
        case ready
        case degraded
    }

    enum SnapshotOutcome: Equatable {
        case fresh
        case degraded(warning: String)
        case failedNoVisibleFrame
    }

    private(set) var phase: Phase = .idle
    private(set) var visibleSurfaceId: String?
    private(set) var pendingReload: PendingReload?

    var overlayMessage: String? {
        switch phase {
        case .loading:
            return "Updating..."
        case .degraded:
            return "Showing last ready frame"
        case .idle, .ready:
            return nil
        }
    }

    func immediateSnapshotOutcome(for surfaceId: String) -> SnapshotOutcome? {
        guard pendingReload == nil else {
            return nil
        }
        guard let visibleSurfaceId else {
            return .failedNoVisibleFrame
        }
        guard visibleSurfaceId == surfaceId else {
            return nil
        }
        return .fresh
    }

    @discardableResult
    mutating func didPresentReadySurface(surfaceId: String, revision: String) -> Bool {
        let currentReload = PendingReload(surfaceId: surfaceId, revision: revision)
        guard pendingReload == currentReload else {
            return false
        }

        visibleSurfaceId = surfaceId
        pendingReload = nil
        phase = .ready
        return true
    }

    mutating func beginReload(surfaceId: String, revision: String) {
        pendingReload = PendingReload(surfaceId: surfaceId, revision: revision)
        phase = .loading
    }

    mutating func markTimedOutSnapshot() -> SnapshotOutcome {
        guard visibleSurfaceId != nil else {
            return .failedNoVisibleFrame
        }

        phase = .degraded
        return .degraded(warning: "captured the currently visible frame after readiness timeout")
    }
}
