// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MicrocanvasViewer",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MicrocanvasViewer", targets: ["MicrocanvasViewer"])
    ],
    targets: [
        .executableTarget(
            name: "MicrocanvasViewer",
            path: "Sources"
        )
    ]
)
