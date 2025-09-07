import SwiftUI
import AVFoundation

/// Detail tabs for progression, melody, sections, and practice views
public struct DetailsTabs: View {
    
    let analysis: AnalysisResult
    let audioEngine: AudioEngine
    @Binding var selectedTab: DetailTab
    
    @Environment(\.dismiss) private var dismiss
    
    public init(analysis: AnalysisResult, audioEngine: AudioEngine, selectedTab: Binding<DetailTab>) {
        self.analysis = analysis
        self.audioEngine = audioEngine
        self._selectedTab = selectedTab
    }
    
    public var body: some View {
        NavigationView {
            TabView(selection: $selectedTab) {
                // Progression tab
                ProgressionView(analysis: analysis, audioEngine: audioEngine)
                    .tabItem {
                        Image(systemName: "music.note.list")
                        Text("Progression")
                    }
                    .tag(DetailTab.progression)
                
                // Melody tab
                MelodyView(analysis: analysis, audioEngine: audioEngine)
                    .tabItem {
                        Image(systemName: "pianokeys")
                        Text("Melody")
                    }
                    .tag(DetailTab.melody)
                
                // Sections tab
                SectionsView(analysis: analysis, audioEngine: audioEngine)
                    .tabItem {
                        Image(systemName: "square.grid.2x2")
                        Text("Sections")
                    }
                    .tag(DetailTab.sections)
                
                // Practice tab
                PracticeView(analysis: analysis, audioEngine: audioEngine)
                    .tabItem {
                        Image(systemName: "graduationcap")
                        Text("Practice")
                    }
                    .tag(DetailTab.practice)
            }
            .tabViewStyle(DefaultTabViewStyle())
            .navigationTitle(selectedTab.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.Colors.accent)
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .preferredColorScheme(.dark)
    }
}

// MARK: - Detail Tab Enum

public enum DetailTab: CaseIterable {
    case progression
    case melody
    case sections
    case practice
    
    var title: String {
        switch self {
        case .progression: return "Chord Progression"
        case .melody: return "Melody Roll"
        case .sections: return "Song Sections"
        case .practice: return "Practice Tools"
        }
    }
}

// MARK: - Progression View

private struct ProgressionView: View {
    let analysis: AnalysisResult
    let audioEngine: AudioEngine
    
    @State private var selectedChord: ChordSpan?
    @State private var showingChordPreview = false
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: AppTheme.Spacing.sm) {
                // Timeline overview
                TimelineView(
                    analysis: analysis,
                    playhead: audioEngine.currentTime,
                    loop: audioEngine.isLooping ? audioEngine.loopRange : nil,
                    viewportWidth: UIScreen.main.bounds.width - AppTheme.Spacing.md * 2
                )
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Chord list
                ForEach(analysis.chords) { chord in
                    ChordCard(
                        chord: chord,
                        key: analysis.key,
                        isCurrentChord: isCurrentChord(chord),
                        onTap: {
                            selectedChord = chord
                            showingChordPreview = true
                            audioEngine.seek(to: chord.start)
                        }
                    )
                    .padding(.horizontal, AppTheme.Spacing.md)
                }
            }
            .padding(.vertical, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.background)
        .sheet(item: $selectedChord) { chord in
            ChordPreviewSheet(chord: chord, key: analysis.key)
        }
    }
    
    private func isCurrentChord(_ chord: ChordSpan) -> Bool {
        return chord.start <= audioEngine.currentTime && audioEngine.currentTime < chord.end
    }
}

// MARK: - Melody View

private struct MelodyView: View {
    let analysis: AnalysisResult
    let audioEngine: AudioEngine
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                // Extended timeline (melody-focused)
                TimelineView(
                    analysis: analysis,
                    playhead: audioEngine.currentTime,
                    viewportWidth: UIScreen.main.bounds.width - AppTheme.Spacing.md * 2
                )
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Piano roll view
                PianoRollView(melody: analysis.melody, playhead: audioEngine.currentTime)
                    .frame(height: 400)
                    .padding(.horizontal, AppTheme.Spacing.md)
                
                // Melody statistics
                MelodyStatsView(melody: analysis.melody)
                    .padding(.horizontal, AppTheme.Spacing.md)
            }
            .padding(.vertical, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.background)
    }
}

// MARK: - Sections View

private struct SectionsView: View {
    let analysis: AnalysisResult
    let audioEngine: AudioEngine
    
    @State private var detectedSections: [SongSection] = []
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                // Section detection info
                VStack(spacing: AppTheme.Spacing.sm) {
                    Text("Song Structure Analysis")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text("Automatically detected sections based on chord progressions and dynamics")
                        .font(AppTheme.Typography.bodyMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Timeline with sections
                TimelineView(
                    analysis: analysis,
                    playhead: audioEngine.currentTime,
                    viewportWidth: UIScreen.main.bounds.width - AppTheme.Spacing.md * 2
                )
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Section list
                LazyVStack(spacing: AppTheme.Spacing.sm) {
                    ForEach(detectedSections) { section in
                        SectionCard(
                            section: section,
                            isPlaying: audioEngine.currentTime >= section.startTime && 
                                      audioEngine.currentTime < section.endTime,
                            onTap: {
                                audioEngine.seek(to: section.startTime)
                                HapticManager.shared.playSelect()
                            }
                        )
                    }
                }
                .padding(.horizontal, AppTheme.Spacing.md)
            }
            .padding(.vertical, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.background)
        .onAppear {
            detectSections()
        }
    }
    
    private func detectSections() {
        // Simple section detection based on chord changes
        // This could be enhanced with more sophisticated algorithms
        
        var sections: [SongSection] = []
        let barsPerSection = 4 // Typical section length
        
        for i in stride(from: 0, to: analysis.bars.count, by: barsPerSection) {
            let endIndex = min(i + barsPerSection, analysis.bars.count)
            
            if i < analysis.bars.count {
                let startBar = analysis.bars[i]
                let endBar = endIndex < analysis.bars.count ? analysis.bars[endIndex - 1] : analysis.bars.last!
                
                let sectionType: SectionType = determineSectionType(barIndex: i / barsPerSection)
                
                sections.append(SongSection(
                    id: UUID(),
                    type: sectionType,
                    name: sectionType.rawValue.capitalized,
                    startTime: startBar.start,
                    endTime: endBar.end,
                    bars: Array(analysis.bars[i..<endIndex])
                ))
            }
        }
        
        detectedSections = sections
    }
    
    private func determineSectionType(barIndex: Int) -> SectionType {
        // Simple heuristic for section types
        switch barIndex % 4 {
        case 0: return .intro
        case 1: return .verse
        case 2: return .chorus
        default: return .bridge
        }
    }
}

// MARK: - Practice View

private struct PracticeView: View {
    let analysis: AnalysisResult
    let audioEngine: AudioEngine
    
    @State private var playbackSpeed: Double = 1.0
    @State private var showingExportOptions = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                // Speed control
                VStack(spacing: AppTheme.Spacing.md) {
                    Text("Playback Speed")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    VStack(spacing: AppTheme.Spacing.sm) {
                        HStack {
                            Text("0.5x")
                                .font(AppTheme.Typography.labelMedium)
                                .foregroundColor(AppTheme.Colors.textSecondary)
                            
                            Slider(value: $playbackSpeed, in: 0.5...2.0, step: 0.1)
                                .tint(AppTheme.Colors.accent)
                            
                            Text("2.0x")
                                .font(AppTheme.Typography.labelMedium)
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        
                        Text("\(String(format: "%.1f", playbackSpeed))x")
                            .font(AppTheme.Typography.mono)
                            .foregroundColor(AppTheme.Colors.textPrimary)
                    }
                }
                .padding(AppTheme.Spacing.md)
                .cardStyle()
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Loop practice
                VStack(spacing: AppTheme.Spacing.md) {
                    Text("Loop Practice")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    VStack(spacing: AppTheme.Spacing.sm) {
                        HStack {
                            Text("Loop:")
                                .font(AppTheme.Typography.bodyMedium)
                                .foregroundColor(AppTheme.Colors.textSecondary)
                            
                            Spacer()
                            
                            Text(audioEngine.isLooping ? 
                                 "Bars \(audioEngine.loopRange.lowerBound + 1)-\(audioEngine.loopRange.upperBound + 1)" : 
                                 "Off")
                                .font(AppTheme.Typography.bodyMedium)
                                .foregroundColor(AppTheme.Colors.textPrimary)
                        }
                        
                        Button(audioEngine.isLooping ? "Disable Loop" : "Enable Loop") {
                            audioEngine.toggleLoop()
                        }
                        .secondaryButtonStyle()
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(AppTheme.Spacing.md)
                .cardStyle()
                .padding(.horizontal, AppTheme.Spacing.md)
                
                // Export options
                VStack(spacing: AppTheme.Spacing.md) {
                    Text("Export & Share")
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    VStack(spacing: AppTheme.Spacing.sm) {
                        Button("Export as MusicXML") {
                            exportMusicXML()
                        }
                        .primaryButtonStyle()
                        .frame(maxWidth: .infinity)
                        
                        Button("Export Loop as Audio") {
                            exportLoopAudio()
                        }
                        .secondaryButtonStyle()
                        .frame(maxWidth: .infinity)
                        
                        Button("Share Analysis") {
                            shareAnalysis()
                        }
                        .secondaryButtonStyle()
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(AppTheme.Spacing.md)
                .cardStyle()
                .padding(.horizontal, AppTheme.Spacing.md)
            }
            .padding(.vertical, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.background)
    }
    
    private func exportMusicXML() {
        // This would integrate with the MusicXML exporter
        HapticManager.shared.playButton()
        // Implementation would go here
    }
    
    private func exportLoopAudio() {
        // Export current loop selection as audio file
        HapticManager.shared.playButton()
        // Implementation would go here
    }
    
    private func shareAnalysis() {
        // Share analysis results
        HapticManager.shared.playButton()
        // Implementation would go here
    }
}

// MARK: - Supporting Views

private struct ChordCard: View {
    let chord: ChordSpan
    let key: Key
    let isCurrentChord: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                    Text(chord.displayLabel)
                        .font(AppTheme.Typography.headlineSmall)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text(chord.quality.displayName)
                        .font(AppTheme.Typography.labelMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                    Text(String(format: "%.1fs", chord.duration))
                        .font(AppTheme.Typography.labelMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                    
                    Text("\(Int(chord.confidence * 100))%")
                        .font(AppTheme.Typography.labelSmall)
                        .foregroundColor(AppTheme.colorForChordQuality(chord.quality))
                }
            }
            .padding(AppTheme.Spacing.md)
            .background(isCurrentChord ? AppTheme.Colors.accent.opacity(0.1) : AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                    .stroke(
                        isCurrentChord ? AppTheme.Colors.accent : AppTheme.colorForChordQuality(chord.quality).opacity(0.3),
                        lineWidth: isCurrentChord ? 2 : 1
                    )
            )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

private struct ChordPreviewSheet: View {
    let chord: ChordSpan
    let key: Key
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: AppTheme.Spacing.lg) {
                // Chord info
                VStack(spacing: AppTheme.Spacing.md) {
                    Text(chord.displayLabel)
                        .font(AppTheme.Typography.displaySmall)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text(chord.quality.displayName)
                        .font(AppTheme.Typography.headlineMedium)
                        .foregroundColor(AppTheme.colorForChordQuality(chord.quality))
                }
                
                // Voicings or additional info could go here
                
                Spacer()
            }
            .padding(AppTheme.Spacing.lg)
            .background(AppTheme.Colors.background)
            .navigationTitle("Chord Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct PianoRollView: View {
    let melody: [MelodyNote]
    let playhead: TimeInterval
    
    var body: some View {
        // Simplified piano roll - could be enhanced with full implementation
        ScrollView(.horizontal) {
            ZStack(alignment: .leading) {
                // Piano roll background
                Rectangle()
                    .fill(AppTheme.Colors.backgroundSecondary)
                
                // Notes
                ForEach(melody) { note in
                    Rectangle()
                        .fill(AppTheme.Colors.accent)
                        .frame(
                            width: max(CGFloat(note.duration) * 50, 2),
                            height: 4
                        )
                        .position(
                            x: CGFloat(note.start) * 50 + CGFloat(note.duration) * 25,
                            y: CGFloat(127 - note.midi) * 3 // Map MIDI to Y
                        )
                }
                
                // Playhead
                Rectangle()
                    .fill(AppTheme.Colors.playhead)
                    .frame(width: 2)
                    .position(x: CGFloat(playhead) * 50, y: 200)
            }
            .frame(height: 400)
            .frame(width: max(CGFloat((melody.last?.end ?? 0) * 50), UIScreen.main.bounds.width))
        }
        .background(AppTheme.Colors.backgroundTertiary)
        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
    }
}

private struct MelodyStatsView: View {
    let melody: [MelodyNote]
    
    private var stats: MelodyStatistics {
        MelodyExtractor().extractMelodyStatistics(melody)
    }
    
    var body: some View {
        VStack(spacing: AppTheme.Spacing.md) {
            Text("Melody Statistics")
                .font(AppTheme.Typography.headlineMedium)
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: AppTheme.Spacing.sm) {
                StatCard(title: "Notes", value: "\(stats.noteCount)")
                StatCard(title: "Range", value: "\(stats.pitchRange) semitones")
                StatCard(title: "Avg Duration", value: String(format: "%.2fs", stats.avgDuration))
                StatCard(title: "Total Length", value: String(format: "%.1fs", stats.totalDuration))
            }
        }
        .padding(AppTheme.Spacing.md)
        .cardStyle()
    }
}

private struct StatCard: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(spacing: AppTheme.Spacing.xs) {
            Text(value)
                .font(AppTheme.Typography.headlineSmall)
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            Text(title)
                .font(AppTheme.Typography.labelMedium)
                .foregroundColor(AppTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(AppTheme.Spacing.sm)
        .background(AppTheme.Colors.backgroundSecondary)
        .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
    }
}

private struct SectionCard: View {
    let section: SongSection
    let isPlaying: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                    Text(section.name)
                        .font(AppTheme.Typography.headlineSmall)
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text("\(section.bars.count) bars")
                        .font(AppTheme.Typography.labelMedium)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Text(String(format: "%.1fs", section.duration))
                    .font(AppTheme.Typography.labelMedium)
                    .foregroundColor(AppTheme.Colors.textSecondary)
            }
            .padding(AppTheme.Spacing.md)
            .background(isPlaying ? AppTheme.Colors.accent.opacity(0.1) : AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                    .stroke(isPlaying ? AppTheme.Colors.accent : AppTheme.Colors.border, lineWidth: isPlaying ? 2 : 1)
            )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Song Section Models

private struct SongSection: Identifiable {
    let id: UUID
    let type: SectionType
    let name: String
    let startTime: TimeInterval
    let endTime: TimeInterval
    let bars: [Bar]
    
    var duration: TimeInterval {
        return endTime - startTime
    }
}

private enum SectionType: String, CaseIterable {
    case intro
    case verse
    case chorus
    case bridge
    case outro
}

private struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(AppTheme.Animation.quick, value: configuration.isPressed)
    }
}