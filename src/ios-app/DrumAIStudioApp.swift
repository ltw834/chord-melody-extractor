import SwiftUI
import AVFoundation

@main
struct DrumAIStudioApp: App {
    
    init() {
        setupAudioSession()
        setupAppearance()
    }
    
    var body: some Scene {
        WindowGroup {
            HomeScreen()
                .preferredColorScheme(.dark)
        }
    }
    
    private func setupAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default, options: [.allowBluetooth, .allowAirPlay])
            try audioSession.setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }
    
    private func setupAppearance() {
        // Configure navigation bar appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.systemBackground
        
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
    }
}