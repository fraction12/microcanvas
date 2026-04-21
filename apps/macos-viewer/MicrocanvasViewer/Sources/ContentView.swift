import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: ViewerModel

    var body: some View {
        let presentation = model.presentation

        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(presentation.title)
                        .font(.headline)
                    Text(presentation.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let timestampText = presentation.timestampText {
                    Text(timestampText)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let badgeText = presentation.badgeText {
                    Text(badgeText)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color(nsColor: .controlBackgroundColor), in: Capsule())
                }
                Button("Reload") {
                    model.reload()
                }
            }
            .padding()

            Divider()

            ZStack(alignment: .topTrailing) {
                Group {
                    switch presentation.body {
                    case .surface:
                        if let url = model.activeURL, let manifest = model.manifest {
                            SurfaceView(
                                url: url,
                                manifest: manifest,
                                pendingURL: model.pendingURL,
                                pendingManifest: model.pendingManifest,
                                onWebSurfaceReady: model.handleWebSurfaceReady,
                                onWebSurfaceLoadFailure: model.handleWebSurfaceLoadFailure
                            )
                        }
                    case .placeholder(let placeholder):
                        ViewerPlaceholderView(placeholder: placeholder)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                if let overlayMessage = model.overlayMessage {
                    Text(overlayMessage)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding()
                }
            }
        }
    }
}

private struct ViewerPlaceholderView: View {
    let placeholder: ViewerPlaceholder

    var body: some View {
        ContentUnavailableView {
            Label(placeholder.title, systemImage: placeholder.symbolName)
        } description: {
            VStack(spacing: 6) {
                Text(placeholder.message)
                if let detail = placeholder.detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
