// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "ParakeetSidecar",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(url: "https://github.com/FluidInference/FluidAudio.git", from: "0.6.1")
    ],
    targets: [
        .executableTarget(
            name: "ParakeetSidecar",
            dependencies: [
                .product(name: "FluidAudio", package: "FluidAudio")
            ],
            path: "Sources"
        ),
    ]
)
