import XCTest
import PDFKit
@testable import MicrocanvasViewer

@MainActor
final class SurfaceChromeTests: XCTestCase {
    func testNativeSurfaceChromeMirrorsNeutralWorkbenchTokens() {
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.background), "#f6f7f9")
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.canvas), "#ffffff")
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.raised), "#f9fafb")
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.ink), "#111827")
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.muted), "#5b6472")
        XCTAssertEqual(hex(SurfaceWorkbenchChrome.accent), "#2563eb")
    }

    func testNativeSurfaceChromeAvoidsOldDominantWarmAndTealPalette() {
        let chromeColors = [
            SurfaceWorkbenchChrome.background,
            SurfaceWorkbenchChrome.canvas,
            SurfaceWorkbenchChrome.raised,
            SurfaceWorkbenchChrome.ink,
            SurfaceWorkbenchChrome.muted,
            SurfaceWorkbenchChrome.accent
        ].map(hex)

        let oldPalette = Set([
            "#fdf6e3",
            "#f3e8d0",
            "#f97316",
            "#f59e0b",
            "#14b8a6",
            "#0f766e"
        ])

        XCTAssertTrue(oldPalette.isDisjoint(with: Set(chromeColors)))
    }

    func testPDFSurfaceChromeAppliesNeutralBackground() {
        let pdfView = PDFView()

        SurfaceWorkbenchChrome.apply(to: pdfView)

        XCTAssertEqual(hex(pdfView.backgroundColor), "#f6f7f9")
    }

    func testImageAndFallbackChromeUseWorkbenchFrameTreatment() {
        XCTAssertEqual(SurfaceWorkbenchChrome.frameCornerRadius, 8)
        XCTAssertEqual(SurfaceWorkbenchChrome.fallbackCornerRadius, 8)
        XCTAssertEqual(SurfaceWorkbenchChrome.imagePadding, 28)
        XCTAssertEqual(SurfaceWorkbenchChrome.surfaceInset, 48)
        XCTAssertLessThanOrEqual(SurfaceWorkbenchChrome.frameShadowOpacity, 0.10)
        XCTAssertLessThanOrEqual(SurfaceWorkbenchChrome.frameShadowRadius, 20)
    }

    private func hex(_ color: NSColor) -> String {
        guard let rgb = color.usingColorSpace(.deviceRGB) else {
            XCTFail("Unable to convert color to device RGB")
            return ""
        }

        let red = Int(round(rgb.redComponent * 255))
        let green = Int(round(rgb.greenComponent * 255))
        let blue = Int(round(rgb.blueComponent * 255))
        return String(format: "#%02x%02x%02x", red, green, blue)
    }
}
