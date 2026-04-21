import SwiftUI
import WebKit
import PDFKit
import AppKit

struct SurfaceView: View {
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
                onLoadFailure: onWebSurfaceLoadFailure
            )
        case "pdf":
            PDFSurfaceView(url: url)
        case "image":
            ImageSurfaceView(url: url)
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

    func makeCoordinator() -> Coordinator {
        Coordinator(onReady: onReady, onLoadFailure: onLoadFailure)
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

        init(
            onReady: @escaping (String, String) -> Bool,
            onLoadFailure: @escaping (String, String, String) -> Void
        ) {
            self.onReady = onReady
            self.onLoadFailure = onLoadFailure
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
                }
                return
            }

            if webView == visibleWebView, let visibleTarget, loadingTarget == nil {
                _ = onReady(visibleTarget.surfaceId, visibleTarget.revision)
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
            let webView = WKWebView()
            webView.setValue(false, forKey: "drawsBackground")
            webView.navigationDelegate = self
            return webView
        }

        private func load(_ target: Target, in webView: WKWebView) {
            webView.loadFileURL(target.url, allowingReadAccessTo: target.url.deletingLastPathComponent())
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

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.backgroundColor = .windowBackgroundColor
        return view
    }

    func updateNSView(_ nsView: PDFView, context: Context) {
        nsView.document = PDFDocument(url: url)
    }
}

struct ImageSurfaceView: View {
    let url: URL

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(nsColor: .windowBackgroundColor),
                        Color(nsColor: .controlBackgroundColor)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                if let image = NSImage(contentsOf: url) {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(Color.white.opacity(0.72))
                        .overlay(
                            RoundedRectangle(cornerRadius: 28, style: .continuous)
                                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.08), radius: 28, y: 12)
                        .overlay {
                            Image(nsImage: image)
                                .resizable()
                                .interpolation(.high)
                                .aspectRatio(contentMode: .fit)
                                .padding(28)
                        }
                        .frame(
                            maxWidth: min(geometry.size.width - 48, 960),
                            maxHeight: geometry.size.height - 48
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
        VStack(spacing: 14) {
            Image(systemName: symbolName)
                .font(.system(size: 30, weight: .medium))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
