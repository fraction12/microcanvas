import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: ViewerModel

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model.manifest?.title ?? "Microcanvas Viewer")
                        .font(.headline)
                    Text(model.statusText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Reload") {
                    model.reload()
                }
            }
            .padding()

            Divider()

            Group {
                if let url = model.activeURL, let manifest = model.manifest {
                    SurfaceView(url: url, manifest: manifest)
                } else {
                    ContentUnavailableView(
                        "No Active Surface",
                        systemImage: "square.on.square.dashed",
                        description: Text("Render and show a surface from the CLI, then reload this window.")
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
