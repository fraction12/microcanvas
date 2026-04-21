import SwiftUI
import WebKit
import PDFKit

struct SurfaceView: View {
    let url: URL
    let manifest: SurfaceManifest

    var body: some View {
        switch manifest.renderMode {
        case "wkwebview":
            WebSurfaceView(url: url)
        case "pdf":
            PDFSurfaceView(url: url)
        default:
            FileSurfaceFallback(url: url, manifest: manifest)
        }
    }
}

struct WebSurfaceView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.setValue(false, forKey: "drawsBackground")
        return view
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        nsView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
}

struct PDFSurfaceView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        return view
    }

    func updateNSView(_ nsView: PDFView, context: Context) {
        nsView.document = PDFDocument(url: url)
    }
}

struct FileSurfaceFallback: View {
    let url: URL
    let manifest: SurfaceManifest

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc")
                .font(.system(size: 32))
            Text("Direct preview not yet supported for this format")
                .font(.headline)
            Text(url.path)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("renderMode: \(manifest.renderMode)")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
