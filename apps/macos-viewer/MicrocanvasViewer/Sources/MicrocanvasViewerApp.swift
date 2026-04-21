import SwiftUI

@main
struct MicrocanvasViewerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = ViewerModel()

    var body: some Scene {
        WindowGroup("Microcanvas Viewer") {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 960, minHeight: 640)
                .onAppear {
                    model.reload()
                    model.startPolling()
                }
                .onDisappear {
                    model.stopPolling()
                }
        }
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Reload Active Surface") {
                    model.reload()
                }
                .keyboardShortcut("r")
            }
        }
    }
}
