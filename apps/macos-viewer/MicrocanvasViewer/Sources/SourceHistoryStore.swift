import Foundation

struct SourceHistoryEntry: Decodable, Equatable, Identifiable, Sendable {
    let originalPath: String
    let displayName: String
    let sourceFileName: String
    let sourceKind: String
    let renderMode: String
    let contentType: String
    let externalToRepo: Bool
    let lastShownAt: String
    let showCount: Int

    var id: String {
        originalPath
    }

    var isAvailable: Bool {
        FileManager.default.fileExists(atPath: originalPath)
    }

    var directoryText: String {
        URL(fileURLWithPath: originalPath).deletingLastPathComponent().path
    }
}

private struct SourceHistoryFile: Decodable {
    let entries: [SourceHistoryEntry]
}

struct SourceHistoryStore: Sendable {
    let fileURL: URL

    init(fileURL: URL = SourceHistoryStore.defaultHistoryURL()) {
        self.fileURL = fileURL
    }

    func loadEntries() -> [SourceHistoryEntry] {
        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode(SourceHistoryFile.self, from: data) else {
            return []
        }

        return decoded.entries
    }

    static func defaultHistoryURL() -> URL {
        if let override = ProcessInfo.processInfo.environment["MICROCANVAS_SOURCE_HISTORY_FILE"],
           !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: false)
        }

        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
                .appendingPathComponent("Library", isDirectory: true)
                .appendingPathComponent("Application Support", isDirectory: true)

        return appSupport
            .appendingPathComponent("Microcanvas", isDirectory: true)
            .appendingPathComponent("source-history.json", isDirectory: false)
    }
}

struct SourceHistoryReloadCommand: Equatable, Sendable {
    let executableURL: URL
    let arguments: [String]
    let environment: [String: String]

    static func make(repoRoot: URL, sourcePath: String) -> SourceHistoryReloadCommand {
        let nodeSearchPath = [
            ProcessInfo.processInfo.environment["PATH"],
            "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ":")

        return SourceHistoryReloadCommand(
            executableURL: URL(fileURLWithPath: "/usr/bin/env", isDirectory: false),
            arguments: [
                "node",
                repoRoot
                    .appendingPathComponent("dist", isDirectory: true)
                    .appendingPathComponent("cli", isDirectory: true)
                    .appendingPathComponent("index.js", isDirectory: false)
                    .path,
                "show",
                sourcePath,
                "--json"
            ],
            environment: [
                "MICROCANVAS_DISABLE_NATIVE_VIEWER": "1",
                "PATH": nodeSearchPath
            ]
        )
    }
}

struct SourceHistoryReloader: Sendable {
    func reload(sourcePath: String, repoRoot: URL) async throws {
        try await Task.detached(priority: .userInitiated) {
            try reloadSynchronously(sourcePath: sourcePath, repoRoot: repoRoot)
        }.value
    }

    private func reloadSynchronously(sourcePath: String, repoRoot: URL) throws {
        let command = SourceHistoryReloadCommand.make(repoRoot: repoRoot, sourcePath: sourcePath)
        let process = Process()
        process.executableURL = command.executableURL
        process.arguments = command.arguments
        process.currentDirectoryURL = repoRoot
        process.environment = ProcessInfo.processInfo.environment.merging(command.environment) { _, new in new }

        let output = Pipe()
        let error = Pipe()
        process.standardOutput = output
        process.standardError = error

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let errorData = error.fileHandleForReading.readDataToEndOfFile()
            let outputData = output.fileHandleForReading.readDataToEndOfFile()
            let message = String(data: errorData, encoding: .utf8)
                ?? String(data: outputData, encoding: .utf8)
                ?? "history reload failed"
            throw NSError(
                domain: "MicrocanvasViewer",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: message.trimmingCharacters(in: .whitespacesAndNewlines)]
            )
        }
    }
}
