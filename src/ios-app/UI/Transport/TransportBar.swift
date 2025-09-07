import SwiftUI
import AVFoundation

/// Transport controls with play/pause/stop, loop controls, and position slider
public struct TransportBar: View {
    
    // MARK: - Observed Objects
    @ObservedObject var audioEngine: AudioEngine
    
    // MARK: - Properties
    let analysis: AnalysisResult
    
    // MARK: - State
    @State private var isDraggingPosition = false
    @State private var tempPosition: Double = 0
    @State private var showingLoopPicker = false
    @State private var loopStart: Int = 0
    @State private var loopEnd: Int = 3
    
    public init(audioEngine: AudioEngine, analysis: AnalysisResult) {
        self.audioEngine = audioEngine
        self.analysis = analysis
    }
    
    public var body: some View {
        VStack(spacing: AppTheme.Spacing.sm) {
            // Main transport controls
            HStack(spacing: AppTheme.Spacing.lg) {
                // Transport buttons
                transportButtons
                
                Spacer()
                
                // Time display
                timeDisplay
                
                Spacer()
                
                // Loop controls
                loopControls
            }
            
            // Position slider
            positionSlider
        }
        .padding(AppTheme.Spacing.md)
        .background(AppTheme.Colors.surface)
        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
        .themeShadow(AppTheme.Shadows.medium)
    }
    
    // MARK: - Transport Buttons
    
    private var transportButtons: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            // Play/Pause button
            Button(action: togglePlayPause) {
                Image(systemName: audioEngine.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .foregroundColor(.white)
                    .background(AppTheme.Colors.accent)
                    .clipShape(Circle())
                    .themeShadow(AppTheme.Shadows.small)
            }
            .buttonStyle(ScaleButtonStyle())
            
            // Stop button
            Button(action: stop) {
                Image(systemName: "stop.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .background(AppTheme.Colors.backgroundSecondary)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(AppTheme.Colors.border, lineWidth: 1)
                    )
            }
            .buttonStyle(ScaleButtonStyle())
        }
    }
    
    // MARK: - Time Display
    
    private var timeDisplay: some View {
        VStack(spacing: 2) {
            // Current time
            Text(formatTime(isDraggingPosition ? tempPosition : audioEngine.currentTime))
                .font(AppTheme.Typography.mono)
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            // Duration
            Text("/ \(formatTime(audioEngine.duration))")
                .font(AppTheme.Typography.monoSmall)
                .foregroundColor(AppTheme.Colors.textSecondary)
        }
    }
    
    // MARK: - Loop Controls
    
    private var loopControls: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            // Loop toggle
            Button(action: toggleLoop) {
                Image(systemName: "repeat")
                    .font(.system(size: 16, weight: .medium))
                    .frame(width: 32, height: 32)
                    .foregroundColor(audioEngine.isLooping ? AppTheme.Colors.accent : AppTheme.Colors.textSecondary)
                    .background(audioEngine.isLooping ? AppTheme.Colors.accent.opacity(0.1) : AppTheme.Colors.backgroundSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(audioEngine.isLooping ? AppTheme.Colors.accent : AppTheme.Colors.border, lineWidth: 1)
                    )
            }
            .buttonStyle(ScaleButtonStyle())
            
            // Loop range display/picker
            if audioEngine.isLooping {
                Button(action: { showingLoopPicker = true }) {
                    Text("Bars \(audioEngine.loopRange.lowerBound + 1)-\(audioEngine.loopRange.upperBound + 1)")
                        .font(AppTheme.Typography.labelSmall)
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(AppTheme.Colors.backgroundSecondary)
                        .cornerRadius(4)
                }
                .buttonStyle(ScaleButtonStyle())
            }
        }
        .sheet(isPresented: $showingLoopPicker) {
            loopPickerSheet
        }
    }
    
    // MARK: - Position Slider
    
    private var positionSlider: some View {
        VStack(spacing: 4) {
            // Slider
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Track background
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AppTheme.Colors.backgroundSecondary)
                        .frame(height: 4)
                    
                    // Progress track
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AppTheme.Colors.accent)
                        .frame(
                            width: progressWidth(geometry.size.width),
                            height: 4
                        )
                    
                    // Thumb
                    Circle()
                        .fill(AppTheme.Colors.accent)
                        .frame(width: 16, height: 16)
                        .position(
                            x: progressWidth(geometry.size.width),
                            y: geometry.size.height / 2
                        )
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    isDraggingPosition = true
                                    let progress = min(max(value.location.x / geometry.size.width, 0), 1)
                                    tempPosition = progress * audioEngine.duration
                                }
                                .onEnded { _ in
                                    audioEngine.seek(to: tempPosition)
                                    isDraggingPosition = false
                                }
                        )
                }
            }
            .frame(height: 20)
            .background(Color.clear)
            .onTapGesture { location in
                let progress = location.x / UIScreen.main.bounds.width // Approximate
                audioEngine.seek(to: progress * audioEngine.duration)
            }
            
            // Bar indicators
            if !analysis.bars.isEmpty {
                barIndicators
            }
        }
    }
    
    // MARK: - Bar Indicators
    
    private var barIndicators: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                ForEach(analysis.bars) { bar in
                    VStack(spacing: 1) {
                        Rectangle()
                            .fill(AppTheme.Colors.border)
                            .frame(width: 1, height: 8)
                        
                        Text("\(bar.index + 1)")
                            .font(AppTheme.Typography.labelSmall)
                            .foregroundColor(AppTheme.Colors.textTertiary)
                    }
                    .position(
                        x: CGFloat(bar.start / audioEngine.duration) * geometry.size.width,
                        y: geometry.size.height / 2
                    )
                }
            }
        }
        .frame(height: 16)
        .allowsHitTesting(false)
    }
    
    // MARK: - Loop Picker Sheet
    
    private var loopPickerSheet: some View {
        NavigationView {
            VStack(spacing: AppTheme.Spacing.lg) {
                Text("Set Loop Range")
                    .font(AppTheme.Typography.headlineMedium)
                    .foregroundColor(AppTheme.Colors.textPrimary)
                
                HStack(spacing: AppTheme.Spacing.lg) {
                    // Start bar picker
                    VStack {
                        Text("Start Bar")
                            .font(AppTheme.Typography.labelMedium)
                            .foregroundColor(AppTheme.Colors.textSecondary)
                        
                        Picker("Start", selection: $loopStart) {
                            ForEach(0..<analysis.bars.count, id: \.self) { index in
                                Text("Bar \(index + 1)").tag(index)
                            }
                        }
                        .pickerStyle(WheelPickerStyle())
                        .frame(height: 100)
                    }
                    
                    // End bar picker
                    VStack {
                        Text("End Bar")
                            .font(AppTheme.Typography.labelMedium)
                            .foregroundColor(AppTheme.Colors.textSecondary)
                        
                        Picker("End", selection: $loopEnd) {
                            ForEach(loopStart..<analysis.bars.count, id: \.self) { index in
                                Text("Bar \(index + 1)").tag(index)
                            }
                        }
                        .pickerStyle(WheelPickerStyle())
                        .frame(height: 100)
                    }
                }
                
                Spacer()
            }
            .padding(AppTheme.Spacing.lg)
            .background(AppTheme.Colors.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showingLoopPicker = false
                    }
                    .foregroundColor(AppTheme.Colors.textSecondary)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Set") {
                        audioEngine.setLoopRange(loopStart...loopEnd)
                        showingLoopPicker = false
                    }
                    .foregroundColor(AppTheme.Colors.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            loopStart = audioEngine.loopRange.lowerBound
            loopEnd = audioEngine.loopRange.upperBound
        }
    }
    
    // MARK: - Helper Methods
    
    private func togglePlayPause() {
        if audioEngine.isPlaying {
            audioEngine.pause()
        } else {
            audioEngine.play()
        }
        
        HapticManager.shared.playTransport()
    }
    
    private func stop() {
        audioEngine.stop()
        HapticManager.shared.playTransport()
    }
    
    private func toggleLoop() {
        audioEngine.toggleLoop()
        HapticManager.shared.playButton()
    }
    
    private func progressWidth(_ totalWidth: CGFloat) -> CGFloat {
        let currentTime = isDraggingPosition ? tempPosition : audioEngine.currentTime
        let progress = audioEngine.duration > 0 ? currentTime / audioEngine.duration : 0
        return totalWidth * CGFloat(progress)
    }
    
    private func formatTime(_ time: Double) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        let centiseconds = Int((time.truncatingRemainder(dividingBy: 1)) * 100)
        return String(format: "%d:%02d.%02d", minutes, seconds, centiseconds)
    }
}

// MARK: - Scale Button Style

private struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(AppTheme.Animation.quick, value: configuration.isPressed)
    }
}

// MARK: - Preview

#if DEBUG
struct TransportBar_Previews: PreviewProvider {
    static var previews: some View {
        let audioEngine = AudioEngine()
        let analysis = AnalysisResult.mockData()
        
        TransportBar(audioEngine: audioEngine, analysis: analysis)
            .padding()
            .background(AppTheme.Colors.background)
            .preferredColorScheme(.dark)
    }
}

private extension AnalysisResult {
    static func mockData() -> AnalysisResult {
        return AnalysisResult(
            tempo: 120.0,
            timeSig: TimeSig(numerator: 4, denominator: 4),
            key: Key(tonic: "C", mode: "major"),
            beats: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
            bars: [
                Bar(index: 0, start: 0.0, end: 2.0),
                Bar(index: 1, start: 2.0, end: 4.0),
                Bar(index: 2, start: 4.0, end: 6.0),
                Bar(index: 3, start: 6.0, end: 8.0)
            ],
            chords: [],
            melody: [],
            dynamics: [],
            duration: 8.0
        )
    }
}
#endif