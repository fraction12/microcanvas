import AppKit
import WebKit
import PDFKit

enum PresentedSurface {
    case webContent(URL)
    case imageFile(URL)
    case pdfView(NSView)
}

@MainActor
struct PresentedSurfaceSnapshotter {
    private let captureWebContent: @MainActor (URL) async throws -> NSImage
    private let capturePresentedView: @MainActor (NSView) async throws -> NSImage
    private let captureImageFile: @MainActor (URL) async throws -> NSImage

    init(
        captureWebContent: @MainActor @escaping (URL) async throws -> NSImage = { url in
            try await FullPageWebSnapshotRenderer().capture(url: url)
        },
        capturePresentedView: @MainActor @escaping (NSView) async throws -> NSImage = { view in
            try await view.presentedViewSnapshot()
        },
        captureImageFile: @MainActor @escaping (URL) async throws -> NSImage = { url in
            guard let image = NSImage(contentsOf: url) else {
                throw NSError(
                    domain: "MicrocanvasViewer",
                    code: 14,
                    userInfo: [NSLocalizedDescriptionKey: "Unable to load image surface for snapshot"]
                )
            }
            return image
        }
    ) {
        self.captureWebContent = captureWebContent
        self.capturePresentedView = capturePresentedView
        self.captureImageFile = captureImageFile
    }

    func capture(surface: PresentedSurface, to destination: URL) async throws {
        switch surface {
        case .webContent(let url):
            let image = try await captureWebContent(url)
            try writePNG(image, to: destination)
        case .imageFile(let url):
            let image = try await captureImageFile(url)
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

struct WebSnapshotMetrics: Sendable {
    let width: CGFloat
    let height: CGFloat

    static let zero = WebSnapshotMetrics(width: 0, height: 0)
}

@MainActor
private final class FullPageWebSnapshotRenderer: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private var continuation: CheckedContinuation<Void, Error>?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        self.webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 800), configuration: configuration)
        super.init()
        self.webView.navigationDelegate = self
        self.webView.setValue(false, forKey: "drawsBackground")
    }

    func capture(url: URL) async throws -> NSImage {
        let readAccessURL = url.deletingLastPathComponent()
        try await load(url: url, allowingReadAccessTo: readAccessURL)
        let metrics = (try? await webView.evaluateSnapshotMetrics()) ?? .zero
        let width = max(metrics.width, 1280)
        let height = max(metrics.height, 800)
        guard width > 0, height > 0 else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 15,
                userInfo: [NSLocalizedDescriptionKey: "Unable to determine full web surface size for snapshot"]
            )
        }

        let rect = CGRect(origin: .zero, size: CGSize(width: width, height: height)).integral
        let pdfData = try await webView.capturePDF(rect: rect)
        return try renderPDFSnapshot(pdfData, targetSize: rect.size)
    }

    private func load(url: URL, allowingReadAccessTo readAccessURL: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.continuation = continuation
            webView.loadFileURL(url, allowingReadAccessTo: readAccessURL)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        continuation?.resume()
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}

private extension WKWebView {
    @MainActor
    func capturePDF(rect: CGRect) async throws -> Data {
        let configuration = WKPDFConfiguration()
        configuration.rect = rect

        return try await withCheckedThrowingContinuation { continuation in
            createPDF(configuration: configuration) { result in
                switch result {
                case .success(let data):
                    continuation.resume(returning: data)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    @MainActor
    func evaluateSnapshotMetrics() async throws -> WebSnapshotMetrics {
        try await withCheckedThrowingContinuation { continuation in
            evaluateJavaScript(
                """
                (() => {
                  const doc = document.documentElement;
                  const body = document.body;
                  const width = Math.max(
                    window.innerWidth || 0,
                    doc ? doc.scrollWidth : 0,
                    doc ? doc.offsetWidth : 0,
                    doc ? doc.clientWidth : 0,
                    body ? body.scrollWidth : 0,
                    body ? body.offsetWidth : 0,
                    body ? body.clientWidth : 0
                  );
                  const height = Math.max(
                    window.innerHeight || 0,
                    doc ? doc.scrollHeight : 0,
                    doc ? doc.offsetHeight : 0,
                    doc ? doc.clientHeight : 0,
                    body ? body.scrollHeight : 0,
                    body ? body.offsetHeight : 0,
                    body ? body.clientHeight : 0
                  );
                  return { width, height };
                })();
                """
            ) { value, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let metrics = Self.snapshotMetrics(from: value)
                continuation.resume(returning: metrics)
            }
        }
    }

    static func snapshotMetrics(from value: Any?) -> WebSnapshotMetrics {
        guard let dictionary = value as? [String: Any] else {
            return .zero
        }

        let width = numericValue(dictionary["width"])
        let height = numericValue(dictionary["height"])
        guard width > 0, height > 0 else {
            return .zero
        }

        return WebSnapshotMetrics(width: width, height: height)
    }

    static func numericValue(_ value: Any?) -> CGFloat {
        switch value {
        case let number as NSNumber:
            return CGFloat(number.doubleValue)
        case let double as Double:
            return CGFloat(double)
        case let int as Int:
            return CGFloat(int)
        case let float as Float:
            return CGFloat(float)
        default:
            return 0
        }
    }
}

@MainActor
private func renderPDFSnapshot(_ data: Data, targetSize: CGSize) throws -> NSImage {
    guard let document = PDFDocument(data: data), document.pageCount > 0 else {
        throw NSError(
            domain: "MicrocanvasViewer",
            code: 16,
            userInfo: [NSLocalizedDescriptionKey: "Unable to decode full web snapshot PDF"]
        )
    }

    var pageBounds: [CGRect] = []
    pageBounds.reserveCapacity(document.pageCount)

    for index in 0..<document.pageCount {
        guard let page = document.page(at: index) else {
            continue
        }
        let bounds = page.bounds(for: .mediaBox).integral
        if bounds.width > 0, bounds.height > 0 {
            pageBounds.append(bounds)
        }
    }

    guard !pageBounds.isEmpty else {
        throw NSError(
            domain: "MicrocanvasViewer",
            code: 17,
            userInfo: [NSLocalizedDescriptionKey: "Unable to render full web snapshot with empty bounds"]
        )
    }

    let baseWidth = pageBounds.map(\.width).max() ?? targetSize.width
    let outputWidth = max(targetSize.width, baseWidth)
    let scale = outputWidth / baseWidth
    let outputHeight = pageBounds.reduce(CGFloat(0)) { partial, bounds in
        partial + (bounds.height * scale)
    }

    let imageSize = CGSize(width: outputWidth, height: outputHeight)
    let image = NSImage(size: imageSize)
    image.lockFocus()
    NSColor.clear.set()
    NSBezierPath(rect: NSRect(origin: .zero, size: imageSize)).fill()

    guard let context = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        throw NSError(
            domain: "MicrocanvasViewer",
            code: 18,
            userInfo: [NSLocalizedDescriptionKey: "Unable to create graphics context for full web snapshot"]
        )
    }

    context.saveGState()
    var currentTop: CGFloat = outputHeight

    for index in 0..<document.pageCount {
        guard let page = document.page(at: index) else {
            continue
        }

        let bounds = page.bounds(for: .mediaBox).integral
        guard bounds.width > 0, bounds.height > 0 else {
            continue
        }

        let pageHeight = bounds.height * scale
        currentTop -= pageHeight

        context.saveGState()
        context.translateBy(x: 0, y: currentTop + pageHeight)
        context.scaleBy(x: scale, y: -scale)
        page.draw(with: .mediaBox, to: context)
        context.restoreGState()
    }

    context.restoreGState()
    image.unlockFocus()
    return image
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
