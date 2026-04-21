import XCTest
@testable import MicrocanvasViewer

final class ViewerReadinessCoordinatorTests: XCTestCase {
    func testReadySurfaceReturnsTrueWhenItMatchesPendingReload() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")

        let accepted = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-2")

        XCTAssertTrue(accepted)
        XCTAssertEqual(coordinator.phase, .ready)
        XCTAssertEqual(coordinator.visibleSurfaceId, "surface-a")
        XCTAssertNil(coordinator.pendingReload)
    }

    func testBeginReloadMarksLoadingAndStoresPendingSurface() {
        var coordinator = ViewerReadinessCoordinator()

        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")

        XCTAssertEqual(coordinator.phase, .loading)
        XCTAssertEqual(coordinator.pendingReload, ViewerReadinessCoordinator.PendingReload(surfaceId: "surface-a", revision: "rev-2"))
        XCTAssertNil(coordinator.visibleSurfaceId)
    }

    func testPresentingReadySurfacePromotesVisibleSurfaceAndClearsPendingState() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")

        let accepted = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-2")

        XCTAssertTrue(accepted)
        XCTAssertEqual(coordinator.phase, .ready)
        XCTAssertEqual(coordinator.visibleSurfaceId, "surface-a")
        XCTAssertNil(coordinator.pendingReload)
    }

    func testTimedOutSnapshotWithVisibleSurfaceReturnsDegradedOutcome() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-1")
        _ = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-1")
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")

        let outcome = coordinator.markTimedOutSnapshot()

        XCTAssertEqual(outcome, .degraded(warning: "captured the currently visible frame after readiness timeout"))
        XCTAssertEqual(coordinator.phase, .degraded)
    }

    func testStaleReadySignalDoesNotReplacePendingReload() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-3")

        let accepted = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-2")

        XCTAssertFalse(accepted)
        XCTAssertEqual(coordinator.phase, .loading)
        XCTAssertEqual(coordinator.pendingReload, ViewerReadinessCoordinator.PendingReload(surfaceId: "surface-a", revision: "rev-3"))
        XCTAssertNil(coordinator.visibleSurfaceId)
    }

    func testImmediateSnapshotOutcomeReturnsFreshForReadyVisibleSurface() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-1")
        _ = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-1")

        let outcome = coordinator.immediateSnapshotOutcome(for: "surface-a")

        XCTAssertEqual(outcome, .fresh)
    }

    func testImmediateSnapshotOutcomeWaitsWhilePendingReloadExists() {
        var coordinator = ViewerReadinessCoordinator()
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-1")
        _ = coordinator.didPresentReadySurface(surfaceId: "surface-a", revision: "rev-1")
        coordinator.beginReload(surfaceId: "surface-a", revision: "rev-2")

        let outcome = coordinator.immediateSnapshotOutcome(for: "surface-a")

        XCTAssertNil(outcome)
    }

    func testTimedOutSnapshotWithoutVisibleSurfaceReturnsNoVisibleFrameOutcome() {
        var coordinator = ViewerReadinessCoordinator()

        let outcome = coordinator.markTimedOutSnapshot()

        XCTAssertEqual(outcome, .failedNoVisibleFrame)
        XCTAssertEqual(coordinator.phase, .idle)
    }
}
