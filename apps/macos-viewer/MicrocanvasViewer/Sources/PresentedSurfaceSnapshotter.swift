import AppKit
import WebKit
import PDFKit

enum PresentedSurface {
    case webView(WKWebView)
    case imageFile(URL)
    case pdfView(NSView)
}

@MainActor
struct PresentedSurfaceSnapshotter {
    private let captureWebView: @MainActor (WKWebView) async throws -> NSImage
    private let capturePresentedView: @MainActor (NSView) async throws -> NSImage
    private let captureImageFile: @MainActor (URL) async throws -> NSImage

    init(
        captureWebView: @MainActor @escaping (WKWebView) async throws -> NSImage = { webView in
            try await webView.captureFullPageSnapshot()
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
        self.captureWebView = captureWebView
        self.capturePresentedView = capturePresentedView
        self.captureImageFile = captureImageFile
    }

    func capture(surface: PresentedSurface, to destination: URL) async throws {
        switch surface {
        case .webView(let webView):
            let image = try await captureWebView(webView)
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

private struct WebSurfaceRenderState: Sendable {
    let hasReadinessContract: Bool
    let ready: Bool
    let state: String?
    let svgReady: Bool
}

private extension WKWebView {
    @MainActor
    func captureFullPageSnapshot() async throws -> NSImage {
        try await waitForMicrocanvasSurfaceReadyIfNeeded()
        let metrics = (try? await evaluateSnapshotMetrics()) ?? .zero
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
        let hasRenderedSvg = (try? await evaluateHasRenderedSVG()) ?? false
        if hasRenderedSvg, let rasterizedSvgImage = try await captureRenderedSVGImage() {
            return rasterizedSvgImage
        }
        if hasRenderedSvg {
            return try await captureImageSnapshot(rect: rect)
        }

        let pdfData = try await capturePDF(rect: rect)
        return try renderPDFSnapshot(pdfData, targetSize: rect.size)
    }

    @MainActor
    func waitForMicrocanvasSurfaceReadyIfNeeded(timeoutNanoseconds: UInt64 = 3_000_000_000) async throws {
        let stepNanoseconds: UInt64 = 100_000_000
        var elapsed: UInt64 = 0

        while elapsed < timeoutNanoseconds {
            let state = try await evaluateMicrocanvasRenderState()
            if !state.hasReadinessContract || isMicrocanvasSurfaceReadyForCapture(state) {
                return
            }
            try await Task.sleep(nanoseconds: stepNanoseconds)
            elapsed += stepNanoseconds
        }

        throw NSError(
            domain: "MicrocanvasViewer",
            code: 18,
            userInfo: [NSLocalizedDescriptionKey: "Timed out waiting for surface render readiness before snapshot"]
        )
    }

    private func isMicrocanvasSurfaceReadyForCapture(_ state: WebSurfaceRenderState) -> Bool {
        guard state.ready else {
            return false
        }

        if state.state == "error" {
            return true
        }

        return state.svgReady
    }

    @MainActor
    func evaluateHasRenderedSVG() async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            evaluateJavaScript(
                """
                (() => Boolean(document?.querySelector?.('.diagram-render-output svg')))();
                """
            ) { value, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: value as? Bool ?? false)
            }
        }
    }

    @MainActor
    func captureRenderedSVGImage(timeoutNanoseconds: UInt64 = 3_000_000_000) async throws -> NSImage? {
        let stepNanoseconds: UInt64 = 100_000_000
        var elapsed: UInt64 = 0

        while elapsed < timeoutNanoseconds {
            let result = try await evaluateRenderedSVGDataURLState()
            switch result.state {
            case "done":
                guard let dataURL = result.dataURL else {
                    return nil
                }
                return try decodePNGDataURL(dataURL)
            case "error":
                return nil
            default:
                try await Task.sleep(nanoseconds: stepNanoseconds)
                elapsed += stepNanoseconds
            }
        }

        return nil
    }

    @MainActor
    func evaluateRenderedSVGDataURLState() async throws -> (state: String, dataURL: String?) {
        try await withCheckedThrowingContinuation { continuation in
            evaluateJavaScript(
                """
                (() => {
                  if (window.__microcanvasSvgRasterState === 'done' || window.__microcanvasSvgRasterState === 'error') {
                    return {
                      state: window.__microcanvasSvgRasterState,
                      dataURL: window.__microcanvasSvgRasterDataURL ?? null
                    };
                  }

                  if (window.__microcanvasSvgRasterState !== 'pending') {
                    window.__microcanvasSvgRasterState = 'pending';
                    window.__microcanvasSvgRasterDataURL = null;

                    (async () => {
                      try {
                        const svg = document.querySelector('.diagram-render-output svg');
                        if (!svg) {
                          throw new Error('No rendered SVG available');
                        }

                        const rect = svg.getBoundingClientRect();
                        const bbox = typeof svg.getBBox === 'function' ? svg.getBBox() : null;
                        const width = Math.max(Math.ceil(rect.width || 0), Math.ceil(bbox?.width || 0), 1);
                        const height = Math.max(Math.ceil(rect.height || 0), Math.ceil(bbox?.height || 0), 1);
                        const clone = svg.cloneNode(true);
                        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                        clone.setAttribute('width', String(width));
                        clone.setAttribute('height', String(height));
                        if (!clone.getAttribute('viewBox')) {
                          clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
                        }
                        const serialized = new XMLSerializer().serializeToString(clone);
                        const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        try {
                          const image = await new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve(img);
                            img.onerror = () => reject(new Error('Unable to load serialized SVG'));
                            img.src = url;
                          });
                          const canvas = document.createElement('canvas');
                          canvas.width = width;
                          canvas.height = height;
                          const context = canvas.getContext('2d');
                          if (!context) {
                            throw new Error('Unable to create canvas context');
                          }
                          context.drawImage(image, 0, 0, width, height);
                          window.__microcanvasSvgRasterDataURL = canvas.toDataURL('image/png');
                          window.__microcanvasSvgRasterState = 'done';
                        } finally {
                          URL.revokeObjectURL(url);
                        }
                      } catch (_error) {
                        window.__microcanvasSvgRasterState = 'error';
                        window.__microcanvasSvgRasterDataURL = null;
                      }
                    })();
                  }

                  return {
                    state: window.__microcanvasSvgRasterState || 'pending',
                    dataURL: window.__microcanvasSvgRasterDataURL ?? null
                  };
                })();
                """
            ) { value, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let dictionary = value as? [String: Any] else {
                    continuation.resume(returning: ("pending", nil))
                    return
                }

                let state = dictionary["state"] as? String ?? "pending"
                let dataURL = dictionary["dataURL"] as? String
                continuation.resume(returning: (state, dataURL))
            }
        }
    }

    @MainActor
    func decodePNGDataURL(_ dataURL: String) throws -> NSImage {
        let prefix = "data:image/png;base64,"
        guard dataURL.hasPrefix(prefix) else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 20,
                userInfo: [NSLocalizedDescriptionKey: "Rendered SVG did not produce a PNG data URL"]
            )
        }

        let base64 = String(dataURL.dropFirst(prefix.count))
        guard let data = Data(base64Encoded: base64), let image = NSImage(data: data) else {
            throw NSError(
                domain: "MicrocanvasViewer",
                code: 21,
                userInfo: [NSLocalizedDescriptionKey: "Unable to decode rendered SVG PNG data URL"]
            )
        }

        return image
    }

    @MainActor
    func evaluateMicrocanvasRenderState() async throws -> WebSurfaceRenderState {
        try await withCheckedThrowingContinuation { continuation in
            evaluateJavaScript(
                """
                (() => {
                  const dataset = document?.documentElement?.dataset;
                  const state = dataset?.microcanvasRenderState ?? null;
                  const hasReadinessContract = Object.prototype.hasOwnProperty.call(window, '__microcanvasSurfaceReady') ||
                    Object.prototype.hasOwnProperty.call(dataset ?? {}, 'microcanvasRenderState');
                  const svg = document?.querySelector?.('.diagram-render-output svg');
                  const bbox = svg && typeof svg.getBBox === 'function' ? svg.getBBox() : null;
                  const rect = svg && typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null;
                  const svgReady = Boolean(
                    svg && (
                      (bbox && bbox.width > 0 && bbox.height > 0) ||
                      (rect && rect.width > 0 && rect.height > 0)
                    )
                  );
                  return {
                    hasReadinessContract,
                    ready: Boolean(window.__microcanvasSurfaceReady),
                    state,
                    svgReady
                  };
                })();
                """
            ) { value, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let dictionary = value as? [String: Any] else {
                    continuation.resume(returning: WebSurfaceRenderState(
                        hasReadinessContract: false,
                        ready: false,
                        state: nil,
                        svgReady: false
                    ))
                    return
                }

                let hasReadinessContract = dictionary["hasReadinessContract"] as? Bool ?? false
                let ready = dictionary["ready"] as? Bool ?? false
                let state = dictionary["state"] as? String
                let svgReady = dictionary["svgReady"] as? Bool ?? false
                continuation.resume(returning: WebSurfaceRenderState(
                    hasReadinessContract: hasReadinessContract,
                    ready: ready,
                    state: state,
                    svgReady: svgReady
                ))
            }
        }
    }

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
    func captureImageSnapshot(rect: CGRect) async throws -> NSImage {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = rect
        configuration.afterScreenUpdates = true
        configuration.snapshotWidth = NSNumber(value: Double(rect.width))

        return try await withCheckedThrowingContinuation { continuation in
            takeSnapshot(with: configuration) { image, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let image else {
                    continuation.resume(throwing: NSError(
                        domain: "MicrocanvasViewer",
                        code: 19,
                        userInfo: [NSLocalizedDescriptionKey: "WKWebView returned no image for snapshot"]
                    ))
                    return
                }
                continuation.resume(returning: image)
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
        context.translateBy(x: 0, y: currentTop)
        context.scaleBy(x: scale, y: scale)
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
