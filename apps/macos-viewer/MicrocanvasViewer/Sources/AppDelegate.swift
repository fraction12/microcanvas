import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    static weak var sharedWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let window = NSApp.windows.first {
            Self.sharedWindow = window
        }
    }

    static func bringViewerToFront() {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        guard let window = sharedWindow ?? NSApp.windows.first else {
            return
        }

        sharedWindow = window
        window.collectionBehavior.remove(.transient)
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
