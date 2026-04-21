import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    static weak var sharedWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let window = NSApp.windows.first {
            Self.sharedWindow = window
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
