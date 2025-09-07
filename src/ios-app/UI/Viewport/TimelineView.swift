import SwiftUI

/// High-performance timeline viewport with 60fps playhead animation
/// Renders chord lane, melody lane, and ruler with synchronized playhead
public struct TimelineView: View {
    
    // MARK: - Properties
    let analysis: AnalysisResult
    let playhead: TimeInterval
    let loop: ClosedRange<Int>?
    let viewportWidth: CGFloat
    
    // MARK: - State
    @State private var scrollOffset: CGFloat = 0
    @State private var timelineItems: [TimelineItem] = []
    @State private var isDragging = false
    
    // MARK: - Constants
    private let pixelsPerSecond: CGFloat = 50
    private let laneHeight: CGFloat = 60
    private let rulerHeight: CGFloat = 40
    private let playheadWidth: CGFloat = 2
    
    public init(
        analysis: AnalysisResult,
        playhead: TimeInterval,
        loop: ClosedRange<Int>? = nil,
        viewportWidth: CGFloat = 350
    ) {
        self.analysis = analysis
        self.playhead = playhead
        self.loop = loop
        self.viewportWidth = viewportWidth
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // Timeline viewport
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    ZStack(alignment: .leading) {
                        // Background
                        Rectangle()
                            .fill(AppTheme.Colors.backgroundTertiary)
                            .frame(
                                width: max(viewportWidth, totalWidth),
                                height: totalHeight
                            )
                        
                        // Timeline content
                        Canvas { context, size in
                            drawTimeline(context: context, size: size)
                        }
                        .frame(
                            width: max(viewportWidth, totalWidth),
                            height: totalHeight
                        )
                        
                        // Playhead overlay
                        PlayheadView(
                            position: CGFloat(playhead) * pixelsPerSecond,
                            height: totalHeight
                        )
                    }
                }
                .coordinateSpace(name: "timeline")
                .onAppear {
                    updateTimelineItems()
                }
                .onChange(of: analysis) { _, _ in
                    updateTimelineItems()
                }
                .onReceive(playheadUpdateTimer) { _ in
                    autoScrollToPlayhead(proxy: proxy)
                }
            }
            
            // Timeline info
            HStack {
                Text("♩ = \(Int(analysis.tempo))")
                    .font(AppTheme.Typography.labelMedium)
                    .foregroundColor(AppTheme.Colors.textSecondary)
                
                Spacer()
                
                Text(analysis.key.displayName)
                    .font(AppTheme.Typography.labelMedium)
                    .foregroundColor(AppTheme.Colors.textSecondary)
                
                Spacer()
                
                Text("\(analysis.timeSig.numerator)/\(analysis.timeSig.denominator)")
                    .font(AppTheme.Typography.labelMedium)
                    .foregroundColor(AppTheme.Colors.textSecondary)
            }
            .padding(.horizontal, AppTheme.Spacing.md)
            .padding(.vertical, AppTheme.Spacing.sm)
            .background(AppTheme.Colors.backgroundSecondary)
        }
        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
        .themeShadow(AppTheme.Shadows.medium)
    }
    
    // MARK: - Drawing
    
    private func drawTimeline(context: GraphicsContext, size: CGSize) {
        drawRuler(context: context, size: size)
        drawChordLane(context: context, size: size)
        drawMelodyLane(context: context, size: size)
        drawLoopRegion(context: context, size: size)
    }
    
    private func drawRuler(context: GraphicsContext, size: CGSize) {
        let rulerY: CGFloat = 0
        
        // Background
        context.fill(
            Path(CGRect(x: 0, y: rulerY, width: size.width, height: rulerHeight)),
            with: .color(AppTheme.Colors.backgroundSecondary)
        )
        
        // Beat and bar lines
        for beat in analysis.beats {
            let x = CGFloat(beat) * pixelsPerSecond
            
            let isBarLine = analysis.bars.contains { bar in
                abs(bar.start - beat) < 0.01
            }
            
            let lineHeight: CGFloat = isBarLine ? rulerHeight * 0.8 : rulerHeight * 0.4
            let lineColor: Color = isBarLine ? AppTheme.Colors.barLine : AppTheme.Colors.beatLine
            let lineWidth: CGFloat = isBarLine ? 2 : 1
            
            var path = Path()
            path.move(to: CGPoint(x: x, y: rulerY + (rulerHeight - lineHeight) / 2))
            path.addLine(to: CGPoint(x: x, y: rulerY + (rulerHeight + lineHeight) / 2))
            
            context.stroke(path, with: .color(lineColor), lineWidth: lineWidth)
            
            // Bar numbers
            if isBarLine, let bar = analysis.bars.first(where: { abs($0.start - beat) < 0.01 }) {
                let text = Text("\(bar.index + 1)")
                    .font(AppTheme.Typography.labelSmall)
                    .foregroundColor(AppTheme.Colors.textTertiary)
                
                context.draw(text, at: CGPoint(x: x + 4, y: rulerY + 12))
            }
        }
    }
    
    private func drawChordLane(context: GraphicsContext, size: CGSize) {
        let laneY: CGFloat = rulerHeight
        
        // Background
        context.fill(
            Path(CGRect(x: 0, y: laneY, width: size.width, height: laneHeight)),
            with: .color(AppTheme.Colors.surface)
        )
        
        // Chord blocks
        for chord in analysis.chords {
            let startX = CGFloat(chord.start) * pixelsPerSecond
            let width = CGFloat(chord.duration) * pixelsPerSecond
            
            let blockRect = CGRect(
                x: startX + 2,
                y: laneY + 8,
                width: max(width - 4, 20),
                height: laneHeight - 16
            )
            
            let chordColor = AppTheme.colorForChordQuality(chord.quality)
            
            // Draw chord block
            let blockPath = Path(roundedRect: blockRect, cornerRadius: 6)
            context.fill(blockPath, with: .color(chordColor.opacity(0.8)))
            context.stroke(blockPath, with: .color(chordColor), lineWidth: 1)
            
            // Draw chord label
            if width > 40 { // Only show label if block is wide enough
                let labelText = Text(chord.displayLabel)
                    .font(AppTheme.Typography.labelMedium)
                    .foregroundColor(.white)
                
                let labelPoint = CGPoint(
                    x: blockRect.midX,
                    y: blockRect.midY
                )
                
                context.draw(labelText, at: labelPoint, anchor: .center)
            }
        }
    }
    
    private func drawMelodyLane(context: GraphicsContext, size: CGSize) {
        let laneY: CGFloat = rulerHeight + laneHeight
        
        // Background
        context.fill(
            Path(CGRect(x: 0, y: laneY, width: size.width, height: laneHeight)),
            with: .color(AppTheme.Colors.backgroundSecondary)
        )
        
        // Piano roll background (optional keyboard gutter)
        drawPianoRollBackground(context: context, laneY: laneY)
        
        // Melody notes
        guard !analysis.melody.isEmpty else { return }
        
        let minMidi = analysis.melody.map(\.midi).min() ?? 60
        let maxMidi = analysis.melody.map(\.midi).max() ?? 72
        let midiRange = max(maxMidi - minMidi, 12) // At least one octave
        
        for note in analysis.melody {
            let startX = CGFloat(note.start) * pixelsPerSecond
            let width = max(CGFloat(note.duration) * pixelsPerSecond, 2)
            
            // Map MIDI to Y position
            let normalizedPitch = Double(note.midi - minMidi) / Double(midiRange)
            let noteY = laneY + CGFloat(1.0 - normalizedPitch) * (laneHeight - 16) + 8
            
            let noteRect = CGRect(
                x: startX,
                y: noteY - 2,
                width: width,
                height: 4
            )
            
            let noteColor = AppTheme.Colors.accent
            
            // Draw note
            let notePath = Path(roundedRect: noteRect, cornerRadius: 2)
            context.fill(notePath, with: .color(noteColor))
        }
    }
    
    private func drawPianoRollBackground(context: GraphicsContext, laneY: CGFloat) {
        // Draw subtle lines for octave boundaries
        let lineColor = AppTheme.Colors.border.opacity(0.3)
        
        for octave in 0...6 { // C3 to C9
            let y = laneY + CGFloat(octave) * (laneHeight / 7)
            
            var path = Path()
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: totalWidth, y: y))
            
            context.stroke(path, with: .color(lineColor), lineWidth: 0.5)
        }
    }
    
    private func drawLoopRegion(context: GraphicsContext, size: CGSize) {
        guard let loop = loop, !analysis.bars.isEmpty else { return }
        
        let loopStart = analysis.bars[safe: loop.lowerBound]?.start ?? 0
        let loopEnd = analysis.bars[safe: loop.upperBound]?.end ?? analysis.duration
        
        let startX = CGFloat(loopStart) * pixelsPerSecond
        let endX = CGFloat(loopEnd) * pixelsPerSecond
        
        let loopRect = CGRect(
            x: startX,
            y: 0,
            width: endX - startX,
            height: totalHeight
        )
        
        // Loop region highlight
        context.fill(
            Path(loopRect),
            with: .color(AppTheme.Colors.accent.opacity(0.1))
        )
        
        // Loop boundaries
        let boundaryColor = AppTheme.Colors.accent.opacity(0.6)
        
        var startPath = Path()
        startPath.move(to: CGPoint(x: startX, y: 0))
        startPath.addLine(to: CGPoint(x: startX, y: totalHeight))
        context.stroke(startPath, with: .color(boundaryColor), lineWidth: 2)
        
        var endPath = Path()
        endPath.move(to: CGPoint(x: endX, y: 0))
        endPath.addLine(to: CGPoint(x: endX, y: totalHeight))
        context.stroke(endPath, with: .color(boundaryColor), lineWidth: 2)
    }
    
    // MARK: - Computed Properties
    
    private var totalWidth: CGFloat {
        max(CGFloat(analysis.duration) * pixelsPerSecond, viewportWidth)
    }
    
    private var totalHeight: CGFloat {
        rulerHeight + laneHeight * 2
    }
    
    private var playheadUpdateTimer: Timer.TimerPublisher {
        Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
    }
    
    // MARK: - Helper Methods
    
    private func updateTimelineItems() {
        // Pre-compute layout items for performance
        // This could be expanded for more complex optimizations
        timelineItems = []
    }
    
    private func autoScrollToPlayhead(proxy: ScrollViewReader) {
        let playheadX = CGFloat(playhead) * pixelsPerSecond
        let viewportCenter = viewportWidth / 2
        
        // Auto-scroll to keep playhead centered
        if playheadX > viewportCenter {
            withAnimation(.linear(duration: 1.0/60.0)) {
                scrollOffset = playheadX - viewportCenter
            }
        }
    }
}

// MARK: - Playhead View

private struct PlayheadView: View {
    let position: CGFloat
    let height: CGFloat
    
    var body: some View {
        Rectangle()
            .fill(AppTheme.Colors.playhead)
            .frame(width: 2, height: height)
            .themeShadow(AppTheme.Shadows.playhead)
            .position(x: position, y: height / 2)
            .allowsHitTesting(false)
    }
}

// MARK: - Timeline Item (for future optimization)

private struct TimelineItem: Identifiable {
    let id = UUID()
    let type: ItemType
    let rect: CGRect
    let color: Color
    let label: String?
    
    enum ItemType {
        case chord
        case note
        case beat
        case bar
    }
}

// MARK: - Extensions

private extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Preview

#if DEBUG
struct TimelineView_Previews: PreviewProvider {
    static var previews: some View {
        TimelineView(
            analysis: AnalysisResult.mockData(),
            playhead: 2.5,
            loop: 0...3
        )
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
                Bar(index: 1, start: 2.0, end: 4.0)
            ],
            chords: [
                ChordSpan(start: 0.0, end: 2.0, label: "C", quality: .major, confidence: 0.9, root: "C"),
                ChordSpan(start: 2.0, end: 4.0, label: "Am", quality: .minor, confidence: 0.8, root: "A")
            ],
            melody: [
                MelodyNote(start: 0.0, end: 0.5, midi: 60),
                MelodyNote(start: 0.5, end: 1.0, midi: 62),
                MelodyNote(start: 1.0, end: 1.5, midi: 64),
                MelodyNote(start: 2.0, end: 2.5, midi: 57)
            ],
            dynamics: [
                DynamicsPoint(time: 0.0, rmsDB: -20),
                DynamicsPoint(time: 2.0, rmsDB: -18)
            ],
            duration: 4.0
        )
    }
}
#endif