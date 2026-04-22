import AppKit
import WebKit

enum PresentedSurface {
    case webView(WKWebView)
    case imageView(NSView)
    case pdfView(NSView)
}

@MainActor
struct PresentedSurfaceSnapshotter {
    private let captureWebView: (WKWebView) async throws -> NSImage
    private let capturePresentedView: (NSView) async throws -> NSImage

    init(
        captureWebView: @escaping (WKWebView) async throws -> NSImage = { webView in
            try await webView.presentedWebSnapshot()
        },
        capturePresentedView: @escaping (NSView) async throws -> NSImage = { view in
            try await view.presentedViewSnapshot()
        }
    ) {
        self.captureWebView = captureWebView
        self.capturePresentedView = capturePresentedView
    }

    func capture(surface: PresentedSurface, to destination: URL) async throws {
        switch surface {
        case .webView(let webView):
            let image = try await captureWebView(webView)
            try writePNG(image, to: destination)
        case .imageView(let view):
            let image = try await capturePresentedView(view)
            try writePNG(image, to: destination)
        case .pdfView(let view):
            let image = try await capturePresentedView(view)
            try writePNG(image, to: destination)
        }
    }

    private func writePNG(_ image: NSImage, to destination: URL) throws {
        guard let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 10,
                userInfo: [NSLocalizedDescriptionKey: "Unable to encode snapshot as PNG"]
            )
        }
        try png.write(to: destination)
    }
}

private extension WKWebView {
    @MainActor
    func presentedWebSnapshot() async throws -> NSImage {
        try await withCheckedThrowingContinuation { continuation in
            takeSnapshot(with: nil) { image, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let image else {
                    continuation.resume(
                        throwing: NSError(
                            domain: "MicrocanvasViewer",
                            code: 11,
                            userInfo: [NSLocalizedDescriptionKey: "Unable to capture presented web surface"]
                        )
                    )
                    return
                }

                continuation.resume(returning: image)
            }
        }
    }
}

private extension NSView {
    @MainActor
    func presentedViewSnapshot() async throws -> NSImage {
        let bounds = self.bounds.integral
        guard bounds.width > 0, bounds.height > 0 else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 12,
                userInfo: [NSLocalizedDescriptionKey: "Unable to capture presented surface with empty bounds"]
            )
        }

        layoutSubtreeIfNeeded()
        guard let rep = bitmapImageRepForCachingDisplay(in: bounds) else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 13,
                userInfo: [NSLocalizedDescriptionKey: "Unable to create image buffer for presented surface"]
            )
        }

        cacheDisplay(in: bounds, to: rep)
        let image = NSImage(size: bounds.size)
        image.addRepresentation(rep)
        return image
    }
}
