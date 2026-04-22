import Foundation

struct LastGoodSurfaceRecord: Codable, Equatable {
    let surfaceId: String
    let title: String
    let renderMode: String
    let updatedAt: String
    let artifactPath: String
}

struct LastGoodSurfaceStore {
    private let fileManager: FileManager
    private let fileName = "last-good-surface.json"

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func save(_ record: LastGoodSurfaceRecord, in runtimeRoot: URL) throws {
        try fileManager.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(record)
        try data.write(
            to: runtimeRoot.appendingPathComponent(fileName, isDirectory: false),
            options: [.atomic]
        )
    }

    func loadRecoverableRecord(in runtimeRoot: URL) throws -> LastGoodSurfaceRecord? {
        let fileURL = runtimeRoot.appendingPathComponent(fileName, isDirectory: false)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        guard let data = try? Data(contentsOf: fileURL) else {
            return nil
        }

        guard let record = try? JSONDecoder().decode(LastGoodSurfaceRecord.self, from: data) else {
            return nil
        }

        guard fileManager.fileExists(atPath: record.artifactPath) else {
            return nil
        }

        return record
    }
}
