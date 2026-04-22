import XCTest
@testable import MicrocanvasViewer

final class ViewerPresentationTests: XCTestCase {
    func testNoActiveSurfaceStateIsIntentional() {
        let presentation = ViewerPresentation(
            manifest: nil,
            activeURL: nil,
            statusText: "No active surface",
            loadFailureMessage: nil
        )

        XCTAssertEqual(presentation.title, "Microcanvas Viewer")
        XCTAssertEqual(presentation.subtitle, "No active surface")
        XCTAssertEqual(
            presentation.body,
            .placeholder(
                ViewerPlaceholder(
                    title: "No Active Surface",
                    message: "Render and show a surface from the CLI to populate this window.",
                    symbolName: "square.on.square.dashed",
                    detail: nil
                )
            )
        )
    }

    func testMissingEntryStateReferencesSurfaceContext() {
        let manifest = SurfaceManifest(
            surfaceId: "surface-1",
            title: "Quarterly Metrics",
            contentType: "text/html",
            entryPath: "index.html",
            createdAt: "2026-04-21T18:55:00Z",
            updatedAt: "2026-04-21T18:57:00Z",
            sourceKind: "table",
            renderMode: "wkwebview"
        )

        let presentation = ViewerPresentation(
            manifest: manifest,
            activeURL: nil,
            statusText: "Active surface entry is missing",
            loadFailureMessage: nil
        )

        XCTAssertEqual(presentation.badgeText, "WEB")
        XCTAssertEqual(
            presentation.body,
            .placeholder(
                ViewerPlaceholder(
                    title: "Surface Unavailable",
                    message: "The active surface is missing its entry artifact.",
                    symbolName: "exclamationmark.triangle",
                    detail: "Quarterly Metrics"
                )
            )
        )
    }

    func testLoadFailureBecomesViewerErrorState() {
        let presentation = ViewerPresentation(
            manifest: nil,
            activeURL: nil,
            statusText: "Viewer error",
            loadFailureMessage: "Unable to decode active manifest."
        )

        XCTAssertEqual(
            presentation.body,
            .placeholder(
                ViewerPlaceholder(
                    title: "Viewer Error",
                    message: "Unable to decode active manifest.",
                    symbolName: "xmark.octagon",
                    detail: nil
                )
            )
        )
    }

    func testLoadFailureKeepsSurfaceBodyWhenCurrentSurfaceStillExists() {
        let manifest = SurfaceManifest(
            surfaceId: "surface-3",
            title: "Still Visible",
            contentType: "text/html",
            entryPath: "index.html",
            createdAt: "2026-04-21T18:55:00Z",
            updatedAt: "2026-04-21T19:00:00Z",
            sourceKind: "generated",
            renderMode: "wkwebview"
        )

        let presentation = ViewerPresentation(
            manifest: manifest,
            activeURL: URL(fileURLWithPath: "/tmp/index.html"),
            statusText: "Failed to load updated surface: timed out",
            loadFailureMessage: "timed out"
        )

        XCTAssertEqual(presentation.title, "Still Visible")
        XCTAssertEqual(presentation.subtitle, "Failed to load updated surface: timed out")
        XCTAssertEqual(presentation.body, .surface)
    }

    func testHeaderIncludesFormattedTimestampForActiveSurface() {
        let manifest = SurfaceManifest(
            surfaceId: "surface-1",
            title: "Render Preview",
            contentType: "text/html",
            entryPath: "index.html",
            createdAt: "2026-04-21T18:55:00Z",
            updatedAt: "2026-04-21T19:05:00Z",
            sourceKind: "generated",
            renderMode: "wkwebview"
        )

        let presentation = ViewerPresentation(
            manifest: manifest,
            activeURL: URL(fileURLWithPath: "/tmp/index.html"),
            statusText: "Ready",
            loadFailureMessage: nil
        )

        XCTAssertEqual(presentation.title, "Render Preview")
        XCTAssertEqual(presentation.badgeText, "WEB")
        XCTAssertEqual(presentation.timestampText, "Updated 2026-04-21 19:05")
        XCTAssertEqual(presentation.body, .surface)
    }

    func testHoldStateKeepsRenderingSurfaceBody() {
        let manifest = SurfaceManifest(
            surfaceId: "surface-2",
            title: "Sticky Surface",
            contentType: "text/html",
            entryPath: "index.html",
            createdAt: "2026-04-21T18:55:00Z",
            updatedAt: "2026-04-21T19:15:00Z",
            sourceKind: "generated",
            renderMode: "wkwebview"
        )

        let presentation = ViewerPresentation(
            manifest: manifest,
            activeURL: URL(fileURLWithPath: "/tmp/index.html"),
            statusText: "Holding last surface",
            loadFailureMessage: nil
        )

        XCTAssertEqual(presentation.title, "Sticky Surface")
        XCTAssertEqual(presentation.subtitle, "Holding last surface")
        XCTAssertEqual(presentation.body, .surface)
    }
}
