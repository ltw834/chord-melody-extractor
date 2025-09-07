// swift-tools-version: 5.10
// DrumAI Studio - Package dependencies

import PackageDescription

let package = Package(
    name: "DrumAIStudio",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "DrumAIStudio",
            targets: ["DrumAIStudio"]
        )
    ],
    dependencies: [
        // AudioKit for advanced DSP and audio processing
        .package(url: "https://github.com/AudioKit/AudioKit", from: "5.6.4"),
        
        // SoundpipeAudioKit for additional audio processing nodes
        .package(url: "https://github.com/AudioKit/SoundpipeAudioKit", from: "5.6.1"),
        
        // Swift Algorithms for utility functions
        .package(url: "https://github.com/apple/swift-algorithms", from: "1.2.0")
    ],
    targets: [
        .target(
            name: "DrumAIStudio",
            dependencies: [
                .product(name: "AudioKit", package: "AudioKit"),
                .product(name: "SoundpipeAudioKit", package: "SoundpipeAudioKit"),
                .product(name: "Algorithms", package: "swift-algorithms")
            ],
            path: "."
        ),
        .testTarget(
            name: "DrumAIStudioTests",
            dependencies: ["DrumAIStudio"],
            path: "Tests"
        )
    ]
)