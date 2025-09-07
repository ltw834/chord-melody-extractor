import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

/// Main home screen with file import and analysis display
public struct HomeScreen: View {
    
    // MARK: - State Objects
    @StateObject private var audioEngine = AudioEngine()
    @StateObject private var analysisManager = AnalysisManager()
    
    // MARK: - State
    @State private var showingFilePicker = false
    @State private var showingDetailTabs = false
    @State private var selectedTab: DetailTab = .progression
    @State private var isAnalyzing = false
    @State private var analysisProgress: Double = 0.0
    @State private var errorMessage: String?
    @State private var showingError = false
    
    public init() {}
    
    public var body: some View {
        GeometryReader { geometry in
            NavigationView {
                ZStack {
                    // Background
                    AppTheme.Colors.background
                        .ignoresSafeArea()
                    
                    if analysisManager.currentAnalysis != nil {
                        // Main interface with analysis
                        mainInterface(geometry: geometry)
                    } else {
                        // Welcome/import interface
                        welcomeInterface
                    }
                    
                    // Analysis overlay
                    if isAnalyzing {
                        analysisOverlay
                    }
                    
                    // Error alert
                    if showingError {
                        errorAlert
                    }
                }
                .navigationTitle("DrumAI Studio")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    toolbarContent
                }
                .fileImporter(
                    isPresented: $showingFilePicker,
                    allowedContentTypes: [.audio, .movie],
                    allowsMultipleSelection: false
                ) { result in
                    handleFileImport(result)
                }
                .fullScreenCover(isPresented: $showingDetailTabs) {
                    DetailsTabs(
                        analysis: analysisManager.currentAnalysis ?? .empty(),
                        audioEngine: audioEngine,
                        selectedTab: $selectedTab
                    )
                }
            }
            .navigationViewStyle(StackNavigationViewStyle())
        }
        .preferredColorScheme(.dark)
        .onAppear {
            setupAudioEngine()
        }
    }
    
    // MARK: - Welcome Interface
    
    private var welcomeInterface: some View {
        VStack(spacing: AppTheme.Spacing.xl) {
            Spacer()
            
            // App icon and title
            VStack(spacing: AppTheme.Spacing.lg) {
                Image(systemName: "music.note.house.fill")
                    .font(.system(size: 80))
                    .foregroundColor(AppTheme.Colors.accent)
                
                VStack(spacing: AppTheme.Spacing.sm) {
                    Text("DrumAI Studio")
                        .font(AppTheme.Typography.displayMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text("Timeline-Centric Chord & Melody Analysis")
                        .font(AppTheme.Typography.bodyLarge)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            
            Spacer()
            
            // Import section
            VStack(spacing: AppTheme.Spacing.md) {
                Text("Import Audio File")
                    .font(AppTheme.Typography.headlineMedium)
                    .foregroundColor(AppTheme.Colors.textPrimary)
                
                Text("Supports WAV, MP3, M4A, and MOV files")
                    .font(AppTheme.Typography.bodyMedium)
                    .foregroundColor(AppTheme.Colors.textSecondary)
                
                // Import button
                Button(action: { showingFilePicker = true }) {
                    HStack(spacing: AppTheme.Spacing.sm) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                        
                        Text("Choose File")
                            .font(AppTheme.Typography.bodyLarge)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(AppTheme.Colors.accent)
                    .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                }
                .buttonStyle(ScaleButtonStyle())
                
                // Drag and drop area
                dragDropArea
            }
            
            Spacer()
        }
        .padding(AppTheme.Spacing.lg)
    }
    
    // MARK: - Main Interface
    
    private func mainInterface(geometry: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            // Info chips
            infoChips
                .padding(.horizontal, AppTheme.Spacing.md)
                .padding(.top, AppTheme.Spacing.sm)
            
            // Timeline viewport
            TimelineView(
                analysis: analysisManager.currentAnalysis ?? .empty(),
                playhead: audioEngine.currentTime,
                loop: audioEngine.isLooping ? audioEngine.loopRange : nil,
                viewportWidth: geometry.size.width - AppTheme.Spacing.md * 2
            )
            .padding(.horizontal, AppTheme.Spacing.md)
            .padding(.vertical, AppTheme.Spacing.md)
            
            // Transport controls
            TransportBar(
                audioEngine: audioEngine,
                analysis: analysisManager.currentAnalysis ?? .empty()
            )
            .padding(.horizontal, AppTheme.Spacing.md)
            
            // Quick tabs
            quickTabsRow
                .padding(.horizontal, AppTheme.Spacing.md)
                .padding(.vertical, AppTheme.Spacing.md)
            
            Spacer()
        }
    }
    
    // MARK: - Info Chips
    
    private var infoChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppTheme.Spacing.sm) {
                if let analysis = analysisManager.currentAnalysis {
                    InfoChip(
                        icon: "metronome",
                        label: "Tempo",
                        value: "\(Int(analysis.tempo)) BPM"
                    )
                    
                    InfoChip(
                        icon: "music.note",
                        label: "Key",
                        value: analysis.key.displayName
                    )
                    
                    InfoChip(
                        icon: "music.quarternote.3",
                        label: "Time Sig",
                        value: "\(analysis.timeSig.numerator)/\(analysis.timeSig.denominator)"
                    )
                    
                    InfoChip(
                        icon: "waveform",
                        label: "Chords",
                        value: "\(analysis.chords.count)"
                    )
                    
                    InfoChip(
                        icon: "pianokeys",
                        label: "Notes",
                        value: "\(analysis.melody.count)"
                    )
                    
                    InfoChip(
                        icon: "clock",
                        label: "Duration",
                        value: formatDuration(analysis.duration)
                    )
                }
            }
            .padding(.horizontal, AppTheme.Spacing.sm)
        }
    }
    
    // MARK: - Quick Tabs Row
    
    private var quickTabsRow: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            QuickTabButton(
                icon: "music.note.list",
                title: "Progression",
                subtitle: "View chord progression",
                action: { openDetailTab(.progression) }
            )
            
            QuickTabButton(
                icon: "pianokeys",
                title: "Melody",
                subtitle: "Piano roll view",
                action: { openDetailTab(.melody) }
            )
            
            QuickTabButton(
                icon: "square.grid.2x2",
                title: "Sections",
                subtitle: "Song structure",
                action: { openDetailTab(.sections) }
            )
            
            QuickTabButton(
                icon: "graduationcap",
                title: "Practice",
                subtitle: "Export & practice",
                action: { openDetailTab(.practice) }
            )
        }
    }
    
    // MARK: - Drag Drop Area
    
    private var dragDropArea: some View {
        RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
            .stroke(
                style: StrokeStyle(lineWidth: 2, dash: [8])
            )
            .foregroundColor(AppTheme.Colors.border)
            .frame(height: 100)
            .overlay(
                VStack(spacing: AppTheme.Spacing.sm) {
                    Image(systemName: "icloud.and.arrow.down")
                        .font(.system(size: 24))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                    
                    Text("Or drag and drop a file here")
                        .font(AppTheme.Typography.bodyMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            )
            .onDrop(of: [.audio, .movie], isTargeted: nil) { providers in
                handleDrop(providers)
            }
    }
    
    // MARK: - Analysis Overlay
    
    private var analysisOverlay: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            VStack(spacing: AppTheme.Spacing.lg) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(AppTheme.Colors.accent)
                
                VStack(spacing: AppTheme.Spacing.sm) {
                    Text("Analyzing Audio")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text("Extracting chords, melody, and musical features...")
                        .font(AppTheme.Typography.bodyMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                
                // Progress bar
                ProgressView(value: analysisProgress)
                    .tint(AppTheme.Colors.accent)
                    .frame(width: 200)
            }
            .padding(AppTheme.Spacing.xl)
            .background(AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusLarge)
            .themeShadow(AppTheme.Shadows.large)
        }
    }
    
    // MARK: - Error Alert
    
    private var errorAlert: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
            
            VStack(spacing: AppTheme.Spacing.lg) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(AppTheme.Colors.error)
                
                VStack(spacing: AppTheme.Spacing.sm) {
                    Text("Analysis Error")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text(errorMessage ?? "An unknown error occurred")
                        .font(AppTheme.Typography.bodyMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                
                Button("OK") {
                    showingError = false
                    errorMessage = nil
                }
                .primaryButtonStyle()
                .padding(.horizontal, AppTheme.Spacing.lg)
            }
            .padding(AppTheme.Spacing.xl)
            .background(AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusLarge)
            .themeShadow(AppTheme.Shadows.large)
        }
        .onTapGesture {
            showingError = false
            errorMessage = nil
        }
    }
    
    // MARK: - Toolbar
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                Button(action: { showingFilePicker = true }) {
                    Label("Import Audio", systemImage: "plus.circle")
                }
                
                if analysisManager.currentAnalysis != nil {
                    Button(action: clearAnalysis) {
                        Label("Clear Analysis", systemImage: "trash")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundColor(AppTheme.Colors.textPrimary)
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func setupAudioEngine() {
        audioEngine.setAnalysisCallback { buffer in
            // Real-time analysis could be added here if needed
        }
    }
    
    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            loadAndAnalyzeFile(url: url)
            
        case .failure(let error):
            errorMessage = "Failed to import file: \(error.localizedDescription)"
            showingError = true
        }
    }
    
    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        
        _ = provider.loadObject(ofClass: URL.self) { url, error in
            DispatchQueue.main.async {
                if let url = url {
                    loadAndAnalyzeFile(url: url)
                } else if let error = error {
                    errorMessage = "Failed to load dropped file: \(error.localizedDescription)"
                    showingError = true
                }
            }
        }
        
        return true
    }
    
    private func loadAndAnalyzeFile(url: URL) {
        Task {
            await MainActor.run {
                isAnalyzing = true
                analysisProgress = 0.0
            }
            
            do {
                // Load audio file
                await MainActor.run { analysisProgress = 0.2 }
                try audioEngine.loadFile(url)
                
                // Perform analysis
                await MainActor.run { analysisProgress = 0.4 }
                let analysis = try await analysisManager.analyzeFile(url) { progress in
                    Task { @MainActor in
                        analysisProgress = 0.4 + (progress * 0.6)
                    }
                }
                
                await MainActor.run {
                    analysisProgress = 1.0
                    
                    // Brief delay to show completion
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        isAnalyzing = false
                        HapticManager.shared.playSuccess()
                    }
                }
                
            } catch {
                await MainActor.run {
                    isAnalyzing = false
                    errorMessage = "Analysis failed: \(error.localizedDescription)"
                    showingError = true
                    HapticManager.shared.playError()
                }
            }
        }
    }
    
    private func clearAnalysis() {
        audioEngine.stop()
        analysisManager.clearAnalysis()
        HapticManager.shared.playButton()
    }
    
    private func openDetailTab(_ tab: DetailTab) {
        selectedTab = tab
        showingDetailTabs = true
        HapticManager.shared.playSelect()
    }
    
    private func formatDuration(_ duration: Double) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Supporting Views

private struct InfoChip: View {
    let icon: String
    let label: String
    let value: String
    
    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.Colors.accent)
            
            Text(value)
                .font(AppTheme.Typography.labelMedium)
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            Text(label)
                .font(AppTheme.Typography.labelSmall)
                .foregroundColor(AppTheme.Colors.textTertiary)
        }
        .padding(.horizontal, AppTheme.Spacing.sm)
        .padding(.vertical, AppTheme.Spacing.xs)
        .background(AppTheme.Colors.surface)
        .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
    }
}

private struct QuickTabButton: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: AppTheme.Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(AppTheme.Colors.accent)
                
                VStack(spacing: 2) {
                    Text(title)
                        .font(AppTheme.Typography.labelMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text(subtitle)
                        .font(AppTheme.Typography.labelSmall)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppTheme.Spacing.sm)
            .background(AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

private struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(AppTheme.Animation.quick, value: configuration.isPressed)
    }
}

// MARK: - Analysis Manager

@MainActor
private class AnalysisManager: ObservableObject {
    @Published var currentAnalysis: AnalysisResult?
    
    private let featureExtractor = FeatureExtractor()
    private let keyDetector = KeyDetector()
    private let chordDetector = ChordDetector()
    private let melodyExtractor = MelodyExtractor()
    
    func analyzeFile(_ url: URL, progressCallback: @escaping (Double) -> Void) async throws -> AnalysisResult {
        // Load audio file
        let audioFile = try AVAudioFile(forReading: url)
        let buffer = AVAudioPCMBuffer(
            pcmFormat: audioFile.processingFormat,
            frameCapacity: AVAudioFrameCount(audioFile.length)
        )!
        try audioFile.read(into: buffer)
        
        progressCallback(0.1)
        
        // Extract features
        let features = featureExtractor.extractFeatures(from: buffer)
        progressCallback(0.3)
        
        // Detect key
        let key = keyDetector.detectKey(from: features.chroma)
        progressCallback(0.4)
        
        // Detect chords
        let chords = chordDetector.detectChords(
            chromaFrames: features.chroma,
            beats: features.beats,
            key: key
        )
        progressCallback(0.6)
        
        // Extract melody
        let melody = melodyExtractor.extractMelody(from: buffer)
        progressCallback(0.8)
        
        // Create time signature (simplified)
        let timeSig = TimeSig.fourFour // Could be enhanced with actual detection
        
        // Create bars from beats
        let bars = createBars(from: features.beats, timeSig: timeSig)
        
        progressCallback(0.9)
        
        let analysis = AnalysisResult(
            tempo: features.tempo,
            timeSig: timeSig,
            key: key,
            beats: features.beats,
            bars: bars,
            chords: chords,
            melody: melody,
            dynamics: features.rmsEnvelope,
            duration: Double(audioFile.length) / audioFile.processingFormat.sampleRate
        )
        
        currentAnalysis = analysis
        progressCallback(1.0)
        
        return analysis
    }
    
    func clearAnalysis() {
        currentAnalysis = nil
    }
    
    private func createBars(from beats: [Double], timeSig: TimeSig) -> [Bar] {
        let beatsPerBar = timeSig.numerator
        var bars: [Bar] = []
        
        for barIndex in 0..<(beats.count / beatsPerBar) {
            let startBeatIndex = barIndex * beatsPerBar
            let endBeatIndex = min(startBeatIndex + beatsPerBar, beats.count)
            
            if startBeatIndex < beats.count {
                let start = beats[startBeatIndex]
                let end = endBeatIndex < beats.count ? beats[endBeatIndex] : start + 2.0
                
                bars.append(Bar(index: barIndex, start: start, end: end))
            }
        }
        
        return bars
    }
}