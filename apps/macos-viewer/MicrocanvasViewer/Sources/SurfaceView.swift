import SwiftUI
import WebKit
import PDFKit
import AppKit

enum SurfaceWorkbenchChrome {
    static let background = NSColor(
        srgbRed: 246.0 / 255.0,
        green: 247.0 / 255.0,
        blue: 249.0 / 255.0,
        alpha: 1
    )
    static let canvas = NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
    static let raised = NSColor(
        srgbRed: 249.0 / 255.0,
        green: 250.0 / 255.0,
        blue: 251.0 / 255.0,
        alpha: 1
    )
    static let ink = NSColor(
        srgbRed: 17.0 / 255.0,
        green: 24.0 / 255.0,
        blue: 39.0 / 255.0,
        alpha: 1
    )
    static let muted = NSColor(
        srgbRed: 91.0 / 255.0,
        green: 100.0 / 255.0,
        blue: 114.0 / 255.0,
        alpha: 1
    )
    static let line = ink.withAlphaComponent(0.14)
    static let softLine = ink.withAlphaComponent(0.08)
    static let accent = NSColor(
        srgbRed: 37.0 / 255.0,
        green: 99.0 / 255.0,
        blue: 235.0 / 255.0,
        alpha: 1
    )

    static let frameCornerRadius: CGFloat = 8
    static let fallbackCornerRadius: CGFloat = 8
    static let imagePadding: CGFloat = 28
    static let surfaceInset: CGFloat = 48
    static let imageMaxWidth: CGFloat = 960
    static let frameShadowOpacity: Double = 0.10
    static let frameShadowRadius: CGFloat = 20
    static let frameShadowYOffset: CGFloat = 10

    @MainActor
    static func apply(to pdfView: PDFView) {
        pdfView.backgroundColor = background
    }
}

struct SurfaceView: View {
    @EnvironmentObject private var model: ViewerModel

    let url: URL
    let manifest: SurfaceManifest
    let pendingURL: URL?
    let pendingManifest: SurfaceManifest?
    let onWebSurfaceReady: (String, String) -> Bool
    let onWebSurfaceLoadFailure: (String, String, String) -> Void

    var body: some View {
        switch manifest.renderMode {
        case "wkwebview":
            WebSurfaceView(
                visibleURL: url,
                visibleSurfaceId: manifest.surfaceId,
                visibleRevision: manifest.updatedAt,
                pendingURL: pendingURL,
                pendingSurfaceId: pendingManifest?.surfaceId,
                pendingRevision: pendingManifest?.updatedAt,
                onReady: onWebSurfaceReady,
                onLoadFailure: onWebSurfaceLoadFailure,
                onPresentedWebViewChanged: model.updatePresentedWebView
            )
        case "pdf":
            PDFSurfaceView(
                url: url,
                surfaceId: manifest.surfaceId,
                revision: manifest.updatedAt,
                onPresentedSurfaceViewChanged: model.updatePresentedSurfaceView
            )
        case "image":
            ImageSurfaceView(
                url: url,
                surfaceId: manifest.surfaceId,
                revision: manifest.updatedAt,
                onPresentedSurfaceViewChanged: model.updatePresentedSurfaceView
            )
        default:
            FileSurfaceFallback(url: url, manifest: manifest)
        }
    }
}

struct WebSurfaceView: NSViewRepresentable {
    struct Target: Equatable {
        let url: URL
        let surfaceId: String
        let revision: String
    }

    let visibleURL: URL
    let visibleSurfaceId: String
    let visibleRevision: String
    let pendingURL: URL?
    let pendingSurfaceId: String?
    let pendingRevision: String?
    let onReady: (String, String) -> Bool
    let onLoadFailure: (String, String, String) -> Void
    let onPresentedWebViewChanged: (WKWebView?, String, String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onReady: onReady,
            onLoadFailure: onLoadFailure,
            onPresentedWebViewChanged: onPresentedWebViewChanged
        )
    }

    func makeNSView(context: Context) -> NSView {
        let container = NSView()
        context.coordinator.container = container
        context.coordinator.ensureVisibleTarget(target: visibleTarget, in: container)
        if let pendingTarget {
            context.coordinator.ensurePendingTarget(target: pendingTarget, in: container)
        }
        return container
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        context.coordinator.container = nsView
        context.coordinator.ensureVisibleTarget(target: visibleTarget, in: nsView)
        if let pendingTarget {
            context.coordinator.ensurePendingTarget(target: pendingTarget, in: nsView)
        }
    }

    private var visibleTarget: Target {
        Target(url: visibleURL, surfaceId: visibleSurfaceId, revision: visibleRevision)
    }

    private var pendingTarget: Target? {
        guard let pendingURL, let pendingSurfaceId, let pendingRevision else {
            return nil
        }
        return Target(url: pendingURL, surfaceId: pendingSurfaceId, revision: pendingRevision)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var container: NSView?
        private var visibleWebView: WKWebView?
        private var visibleTarget: Target?
        private var loadingWebView: WKWebView?
        private var loadingTarget: Target?
        private let onReady: (String, String) -> Bool
        private let onLoadFailure: (String, String, String) -> Void
        private let onPresentedWebViewChanged: (WKWebView?, String, String) -> Void

        init(
            onReady: @escaping (String, String) -> Bool,
            onLoadFailure: @escaping (String, String, String) -> Void,
            onPresentedWebViewChanged: @escaping (WKWebView?, String, String) -> Void
        ) {
            self.onReady = onReady
            self.onLoadFailure = onLoadFailure
            self.onPresentedWebViewChanged = onPresentedWebViewChanged
        }

        func ensureVisibleTarget(target: Target, in container: NSView) {
            if visibleWebView == nil {
                let webView = makeWebView()
                visibleWebView = webView
                visibleTarget = target
                mount(webView, in: container, hidden: false)
                load(target, in: webView)
                return
            }

            guard loadingTarget == nil, visibleTarget != target, let visibleWebView else {
                return
            }

            visibleTarget = target
            load(target, in: visibleWebView)
        }

        func ensurePendingTarget(target: Target, in container: NSView) {
            guard loadingTarget != target else {
                return
            }

            if let loadingWebView {
                loadingWebView.removeFromSuperview()
            }

            let webView = makeWebView()
            loadingWebView = webView
            loadingTarget = target
            mount(webView, in: container, hidden: true)
            load(target, in: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if webView == loadingWebView, let loadingTarget {
                if onReady(loadingTarget.surfaceId, loadingTarget.revision) {
                    promoteLoadingWebView()
                    onPresentedWebViewChanged(webView, loadingTarget.surfaceId, loadingTarget.revision)
                }
                return
            }

            if webView == visibleWebView, let visibleTarget, loadingTarget == nil {
                if onReady(visibleTarget.surfaceId, visibleTarget.revision) {
                    onPresentedWebViewChanged(webView, visibleTarget.surfaceId, visibleTarget.revision)
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            reportFailure(for: webView, error: error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            reportFailure(for: webView, error: error)
        }

        private func reportFailure(for webView: WKWebView, error: Error) {
            if webView == loadingWebView, let loadingTarget {
                onLoadFailure(loadingTarget.surfaceId, loadingTarget.revision, error.localizedDescription)
                return
            }

            if webView == visibleWebView, let visibleTarget {
                onLoadFailure(visibleTarget.surfaceId, visibleTarget.revision, error.localizedDescription)
            }
        }

        private func promoteLoadingWebView() {
            guard let loadingWebView, let loadingTarget else {
                return
            }

            visibleWebView?.removeFromSuperview()
            loadingWebView.isHidden = false
            visibleWebView = loadingWebView
            visibleTarget = loadingTarget
            self.loadingWebView = nil
            self.loadingTarget = nil
        }

        private func makeWebView() -> WKWebView {
            let configuration = WKWebViewConfiguration()
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
            let webView = WKWebView(frame: .zero, configuration: configuration)
            webView.setValue(false, forKey: "drawsBackground")
            webView.navigationDelegate = self
            return webView
        }

        private func load(_ target: Target, in webView: WKWebView) {
            webView.loadFileURL(target.url, allowingReadAccessTo: surfaceRootDirectory(for: target.url))
        }

        private func surfaceRootDirectory(for url: URL) -> URL {
            let parent = url.deletingLastPathComponent()
            if parent.lastPathComponent == "presented" {
                return parent.deletingLastPathComponent()
            }
            return parent
        }

        private func mount(_ webView: WKWebView, in container: NSView, hidden: Bool) {
            webView.isHidden = hidden
            webView.frame = container.bounds
            webView.autoresizingMask = [.width, .height]
            container.addSubview(webView)
        }
    }
}

struct PDFSurfaceView: NSViewRepresentable {
    let url: URL
    let surfaceId: String
    let revision: String
    let onPresentedSurfaceViewChanged: (NSView?, String, String) -> Void

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        SurfaceWorkbenchChrome.apply(to: view)
        onPresentedSurfaceViewChanged(view, surfaceId, revision)
        return view
    }

    func updateNSView(_ nsView: PDFView, context: Context) {
        SurfaceWorkbenchChrome.apply(to: nsView)
        nsView.document = PDFDocument(url: url)
        onPresentedSurfaceViewChanged(nsView, surfaceId, revision)
    }
}

struct ImageSurfaceView: NSViewRepresentable {
    let url: URL
    let surfaceId: String
    let revision: String
    let onPresentedSurfaceViewChanged: (NSView?, String, String) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = NSHostingView(rootView: ImageSurfaceBody(url: url))
        onPresentedSurfaceViewChanged(view, surfaceId, revision)
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard let hostingView = nsView as? NSHostingView<ImageSurfaceBody> else {
            return
        }
        hostingView.rootView = ImageSurfaceBody(url: url)
        onPresentedSurfaceViewChanged(hostingView, surfaceId, revision)
    }
}

struct ImageSurfaceBody: View {
    let url: URL

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color(nsColor: SurfaceWorkbenchChrome.background)
                .ignoresSafeArea()

                if let image = NSImage(contentsOf: url) {
                    RoundedRectangle(cornerRadius: SurfaceWorkbenchChrome.frameCornerRadius, style: .continuous)
                        .fill(Color(nsColor: SurfaceWorkbenchChrome.canvas))
                        .overlay(
                            RoundedRectangle(cornerRadius: SurfaceWorkbenchChrome.frameCornerRadius, style: .continuous)
                                .stroke(Color(nsColor: SurfaceWorkbenchChrome.line), lineWidth: 1)
                        )
                        .shadow(
                            color: Color.black.opacity(SurfaceWorkbenchChrome.frameShadowOpacity),
                            radius: SurfaceWorkbenchChrome.frameShadowRadius,
                            y: SurfaceWorkbenchChrome.frameShadowYOffset
                        )
                        .overlay {
                            Image(nsImage: image)
                                .resizable()
                                .interpolation(.high)
                                .aspectRatio(contentMode: .fit)
                                .padding(SurfaceWorkbenchChrome.imagePadding)
                        }
                        .frame(
                            maxWidth: min(
                                max(geometry.size.width - SurfaceWorkbenchChrome.surfaceInset, 0),
                                SurfaceWorkbenchChrome.imageMaxWidth
                            ),
                            maxHeight: max(geometry.size.height - SurfaceWorkbenchChrome.surfaceInset, 0)
                        )
                } else {
                    ViewerFallbackCard(
                        symbolName: "photo",
                        title: "Image Unavailable",
                        message: "The viewer could not decode this image surface.",
                        detail: url.lastPathComponent
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct FileSurfaceFallback: View {
    let url: URL
    let manifest: SurfaceManifest

    var body: some View {
        ViewerFallbackCard(
            symbolName: "doc.text.magnifyingglass",
            title: "Preview Not Supported",
            message: "This surface was activated, but the viewer does not have a direct presentation path for it yet.",
            detail: "\(manifest.title) • \(manifest.renderMode)"
        )
    }
}

private struct ViewerFallbackCard: View {
    let symbolName: String
    let title: String
    let message: String
    let detail: String

    var body: some View {
        ZStack {
            Color(nsColor: SurfaceWorkbenchChrome.background)
                .ignoresSafeArea()

            VStack(spacing: 14) {
                Image(systemName: symbolName)
                    .font(.system(size: 30, weight: .medium))
                    .foregroundStyle(Color(nsColor: SurfaceWorkbenchChrome.accent))
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Color(nsColor: SurfaceWorkbenchChrome.ink))
                Text(message)
                    .font(.body)
                    .foregroundStyle(Color(nsColor: SurfaceWorkbenchChrome.muted))
                    .multilineTextAlignment(.center)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Color(nsColor: SurfaceWorkbenchChrome.muted).opacity(0.78))
                    .multilineTextAlignment(.center)
            }
            .padding(28)
            .background(
                RoundedRectangle(cornerRadius: SurfaceWorkbenchChrome.fallbackCornerRadius, style: .continuous)
                    .fill(Color(nsColor: SurfaceWorkbenchChrome.raised))
                    .overlay(
                        RoundedRectangle(cornerRadius: SurfaceWorkbenchChrome.fallbackCornerRadius, style: .continuous)
                            .stroke(Color(nsColor: SurfaceWorkbenchChrome.softLine), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.06), radius: 16, y: 8)
            )
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
