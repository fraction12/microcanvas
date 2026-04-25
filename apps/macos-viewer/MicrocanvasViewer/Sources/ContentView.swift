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
                Button {
                    model.toggleHistoryPanel()
                } label: {
                    Image(systemName: model.historyPanelExpanded ? "sidebar.leading" : "sidebar.leading")
                }
                .buttonStyle(.borderless)
                .help(model.historyPanelExpanded ? "Hide source history" : "Show source history")
                Button("Reload") {
                    model.reload()
                }
            }
            .padding()

            Divider()

            HStack(spacing: 0) {
                if model.historyPanelExpanded {
                    SourceHistoryPanel()
                        .frame(width: 300)
                    Divider()
                }

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

                    if let overlayMessage = model.overlayMessage ?? model.historyReloadMessage {
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
}

private struct SourceHistoryPanel: View {
    @EnvironmentObject private var model: ViewerModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("History")
                    .font(.headline)
                Spacer()
                Button {
                    model.refreshSourceHistory()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("Refresh source history")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            Divider()

            if model.sourceHistory.isEmpty {
                ContentUnavailableView {
                    Label("No Recent Sources", systemImage: "clock")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(model.sourceHistory) { entry in
                            SourceHistoryRow(entry: entry)
                        }
                    }
                    .padding(8)
                }
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

private struct SourceHistoryRow: View {
    @EnvironmentObject private var model: ViewerModel

    let entry: SourceHistoryEntry

    var body: some View {
        Button {
            model.showHistoryEntry(entry)
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: iconName)
                    .foregroundStyle(entry.isAvailable ? .secondary : .tertiary)
                    .frame(width: 18)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(entry.displayName)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        if !entry.isAvailable {
                            Text("Missing")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(entry.directoryText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text(entry.renderMode.uppercased())
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.tertiary)
                }

                Spacer(minLength: 0)

                if model.historyReloadInFlightPath == entry.originalPath {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!entry.isAvailable || model.historyReloadInFlightPath != nil)
        .opacity(entry.isAvailable ? 1.0 : 0.55)
    }

    private var iconName: String {
        switch entry.renderMode {
        case "pdf":
            return "doc.richtext"
        case "image":
            return "photo"
        case "wkwebview":
            return "doc.text"
        default:
            return "doc"
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
