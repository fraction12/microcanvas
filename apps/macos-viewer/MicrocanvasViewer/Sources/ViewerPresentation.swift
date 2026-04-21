import Foundation

struct ViewerPlaceholder: Equatable {
    let title: String
    let message: String
    let symbolName: String
    let detail: String?
}

enum ViewerBodyPresentation: Equatable {
    case surface
    case placeholder(ViewerPlaceholder)
}

struct ViewerPresentation: Equatable {
    let title: String
    let subtitle: String
    let badgeText: String?
    let timestampText: String?
    let body: ViewerBodyPresentation

    init(
        manifest: SurfaceManifest?,
        activeURL: URL?,
        statusText: String,
        loadFailureMessage: String?
    ) {
        if let loadFailureMessage {
            self.title = manifest?.title ?? "Microcanvas Viewer"
            self.subtitle = statusText
            self.badgeText = manifest.map(Self.badgeText)
            self.timestampText = manifest.flatMap { Self.timestampText(from: $0.updatedAt) }
            self.body = .placeholder(
                ViewerPlaceholder(
                    title: "Viewer Error",
                    message: loadFailureMessage,
                    symbolName: "xmark.octagon",
                    detail: manifest?.title
                )
            )
            return
        }

        guard let manifest else {
            self.title = "Microcanvas Viewer"
            self.subtitle = statusText
            self.badgeText = nil
            self.timestampText = nil
            self.body = .placeholder(
                ViewerPlaceholder(
                    title: "No Active Surface",
                    message: "Render and show a surface from the CLI to populate this window.",
                    symbolName: "square.on.square.dashed",
                    detail: nil
                )
            )
            return
        }

        self.title = manifest.title
        self.subtitle = statusText
        self.badgeText = Self.badgeText(for: manifest)
        self.timestampText = Self.timestampText(from: manifest.updatedAt)
        if activeURL == nil {
            self.body = .placeholder(
                ViewerPlaceholder(
                    title: "Surface Unavailable",
                    message: "The active surface is missing its entry artifact.",
                    symbolName: "exclamationmark.triangle",
                    detail: manifest.title
                )
            )
        } else {
            self.body = .surface
        }
    }

    private static func badgeText(for manifest: SurfaceManifest) -> String {
        switch manifest.renderMode {
        case "wkwebview":
            return "WEB"
        case "pdf":
            return "PDF"
        case "image":
            return "IMAGE"
        default:
            return manifest.renderMode.uppercased()
        }
    }

    private static func timestampText(from updatedAt: String) -> String? {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: updatedAt) else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return "Updated \(formatter.string(from: date))"
    }
}
