import XCTest
@testable import MicrocanvasViewer

final class SourceHistoryStoreTests: XCTestCase {
    func testLoadsHistoryEntriesAndReportsMissingAvailability() throws {
        let root = temporaryDirectory()
        let available = root.appendingPathComponent("available.md", isDirectory: false)
        try Data("# available".utf8).write(to: available)
        let missing = root.appendingPathComponent("missing.md", isDirectory: false)
        let historyURL = root.appendingPathComponent("source-history.json", isDirectory: false)

        let json = """
        {
          "version": 1,
          "updatedAt": "2026-04-24T20:00:00Z",
          "entries": [
            {
              "originalPath": "\(available.path)",
              "displayName": "available.md",
              "sourceFileName": "available.md",
              "sourceKind": "generated",
              "renderMode": "wkwebview",
              "contentType": "text/html",
              "externalToRepo": false,
              "lastShownAt": "2026-04-24T20:00:00Z",
              "showCount": 1
            },
            {
              "originalPath": "\(missing.path)",
              "displayName": "missing.md",
              "sourceFileName": "missing.md",
              "sourceKind": "generated",
              "renderMode": "wkwebview",
              "contentType": "text/html",
              "externalToRepo": false,
              "lastShownAt": "2026-04-24T19:00:00Z",
              "showCount": 1
            }
          ]
        }
        """
        try Data(json.utf8).write(to: historyURL)

        let entries = SourceHistoryStore(fileURL: historyURL).loadEntries()

        XCTAssertEqual(entries.count, 2)
        XCTAssertTrue(entries[0].isAvailable)
        XCTAssertFalse(entries[1].isAvailable)
        XCTAssertEqual(entries[0].directoryText, root.path)
    }

    func testReloadCommandUsesExistingCliShowFlowWithoutLaunchingAnotherViewer() {
        let repoRoot = URL(fileURLWithPath: "/tmp/microcanvas-repo", isDirectory: true)
        let sourcePath = "/tmp/source.md"

        let command = SourceHistoryReloadCommand.make(repoRoot: repoRoot, sourcePath: sourcePath)

        XCTAssertEqual(command.executableURL.path, "/usr/bin/env")
        XCTAssertEqual(command.arguments, [
            "node",
            "/tmp/microcanvas-repo/dist/cli/index.js",
            "show",
            sourcePath,
            "--json"
        ])
        XCTAssertEqual(command.environment["MICROCANVAS_DISABLE_NATIVE_VIEWER"], "1")
        XCTAssertTrue(command.environment["PATH"]?.contains("/opt/homebrew/bin") ?? false)
        XCTAssertTrue(command.environment["PATH"]?.contains("/usr/local/bin") ?? false)
    }

    private func temporaryDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("microcanvas-history-tests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock {
            try? FileManager.default.removeItem(at: url)
        }
        return url
    }
}
