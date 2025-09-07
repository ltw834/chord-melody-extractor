import Foundation

/// Advanced chord detection with template matching and contextual analysis
public final class ChordDetector {
    
    private let keyDetector = KeyDetector()
    
    // MARK: - Chord Templates
    
    /// Chord template definitions (chroma vectors for each chord type)
    private struct ChordTemplate {
        let quality: ChordQuality
        let intervals: [Int] // Semitone intervals from root
        let weight: Double // Template weight for scoring
        
        init(quality: ChordQuality, intervals: [Int], weight: Double = 1.0) {
            self.quality = quality
            self.intervals = intervals
            self.weight = weight
        }
        
        /// Generate chroma vector for this template
        func chromaVector() -> [Double] {
            var chroma = Array(repeating: 0.0, count: 12)
            for interval in intervals {
                chroma[interval % 12] = 1.0
            }
            return normalizeChroma(chroma)
        }
        
        private func normalizeChroma(_ chroma: [Double]) -> [Double] {
            let sum = chroma.reduce(0, +)
            return sum > 0 ? chroma.map { $0 / sum } : chroma
        }
    }
    
    /// All chord templates used for detection
    private let chordTemplates: [ChordTemplate] = [
        // Triads
        ChordTemplate(quality: .major, intervals: [0, 4, 7]),
        ChordTemplate(quality: .minor, intervals: [0, 3, 7]),
        ChordTemplate(quality: .diminished, intervals: [0, 3, 6]),
        ChordTemplate(quality: .augmented, intervals: [0, 4, 8]),
        
        // Suspended chords
        ChordTemplate(quality: .suspended2, intervals: [0, 2, 7]),
        ChordTemplate(quality: .suspended4, intervals: [0, 5, 7]),
        
        // Sixth chords
        ChordTemplate(quality: .sixth, intervals: [0, 4, 7, 9]),
        ChordTemplate(quality: .add9, intervals: [0, 4, 7, 14]), // add9 = root + major third + fifth + ninth
        
        // Seventh chords
        ChordTemplate(quality: .major7, intervals: [0, 4, 7, 11]),
        ChordTemplate(quality: .minor7, intervals: [0, 3, 7, 10]),
        ChordTemplate(quality: .dominant7, intervals: [0, 4, 7, 10]),
        ChordTemplate(quality: .minorSeven5, intervals: [0, 3, 6, 10]), // half-diminished
        
        // Extended chords (with lower weights to prefer simpler chords)
        ChordTemplate(quality: .ninth, intervals: [0, 4, 7, 10, 14], weight: 0.8),
        ChordTemplate(quality: .eleventh, intervals: [0, 4, 7, 10, 14, 17], weight: 0.7),
        ChordTemplate(quality: .thirteenth, intervals: [0, 4, 7, 10, 14, 17, 21], weight: 0.6),
    ]
    
    // MARK: - Configuration
    
    private let minChordDuration: Double = 0.3
    private let contextWeight: Double = 0.2
    private let hysteresisThreshold: Double = 0.05
    
    public init() {}
    
    // MARK: - Public Methods
    
    /// Detect chords from chroma features with beat synchronization
    public func detectChords(
        chromaFrames: [[Float]],
        beats: [Double],
        key: Key,
        frameDuration: Double = 0.02 // Default hop size in seconds
    ) -> [ChordSpan] {
        
        guard !chromaFrames.isEmpty, !beats.isEmpty else { return [] }
        
        // Analyze chroma at each beat
        let beatChords = analyzeBeatSynchronousChords(
            chromaFrames: chromaFrames,
            beats: beats,
            key: key,
            frameDuration: frameDuration
        )
        
        // Merge and quantize chords
        let mergedChords = mergeConsecutiveChords(beatChords)
        let quantizedChords = quantizeChordDurations(mergedChords)
        
        print("Detected \(quantizedChords.count) chords")
        
        return quantizedChords
    }
    
    /// Analyze single chroma frame for chord candidates
    public func analyzeChromaFrame(_ chroma: [Float], key: Key) -> [(ChordSpan, Double)] {
        let chromaDouble = chroma.map(Double.init)
        
        var candidates: [(ChordSpan, Double)] = []
        
        // Test all possible root notes
        for root in 0..<12 {
            let rootName = keyDetector.getEnharmonicSpelling(noteClass: root, in: key)
            
            // Test all chord templates
            for template in chordTemplates {
                let score = computeChordScore(
                    chroma: chromaDouble,
                    template: template,
                    root: root,
                    key: key
                )
                
                if score > 0.3 { // Minimum threshold
                    let label = formatChordLabel(root: rootName, quality: template.quality)
                    let chordSpan = ChordSpan(
                        start: 0.0, end: 1.0, // Dummy times
                        label: label,
                        quality: template.quality,
                        confidence: score,
                        root: rootName
                    )
                    
                    candidates.append((chordSpan, score))
                }
            }
        }
        
        // Sort by score and return top candidates
        candidates.sort { $0.1 > $1.1 }
        return Array(candidates.prefix(5))
    }
    
    // MARK: - Private Methods
    
    private func analyzeBeatSynchronousChords(
        chromaFrames: [[Float]],
        beats: [Double],
        key: Key,
        frameDuration: Double
    ) -> [ChordSpan] {
        
        var chords: [ChordSpan] = []
        
        for i in 0..<beats.count {
            let beatStart = beats[i]
            let beatEnd = i < beats.count - 1 ? beats[i + 1] : beatStart + 0.5
            
            // Find chroma frames within this beat
            let startFrame = Int(beatStart / frameDuration)
            let endFrame = Int(beatEnd / frameDuration)
            
            guard startFrame < chromaFrames.count else { continue }
            let actualEndFrame = min(endFrame, chromaFrames.count)
            
            // Average chroma over the beat
            let beatChromaFrames = Array(chromaFrames[startFrame..<actualEndFrame])
            let avgChroma = averageChroma(beatChromaFrames)
            
            // Find best chord for this beat
            if let bestChord = findBestChord(chroma: avgChroma, key: key, start: beatStart, end: beatEnd) {
                chords.append(bestChord)
            }
        }
        
        return chords
    }
    
    private func averageChroma(_ chromaFrames: [[Float]]) -> [Double] {
        guard !chromaFrames.isEmpty else { return Array(repeating: 0.0, count: 12) }
        
        var avgChroma = Array(repeating: 0.0, count: 12)
        
        for frame in chromaFrames {
            for (i, value) in frame.enumerated() {
                if i < 12 {
                    avgChroma[i] += Double(value)
                }
            }
        }
        
        let frameCount = Double(chromaFrames.count)
        return avgChroma.map { $0 / frameCount }
    }
    
    private func findBestChord(chroma: [Double], key: Key, start: Double, end: Double) -> ChordSpan? {
        var bestScore = 0.0
        var bestChord: ChordSpan?
        
        // Test all possible roots and templates
        for root in 0..<12 {
            let rootName = keyDetector.getEnharmonicSpelling(noteClass: root, in: key)
            
            for template in chordTemplates {
                let score = computeChordScore(
                    chroma: chroma,
                    template: template,
                    root: root,
                    key: key
                )
                
                if score > bestScore {
                    bestScore = score
                    let label = formatChordLabel(root: rootName, quality: template.quality)
                    
                    bestChord = ChordSpan(
                        start: start,
                        end: end,
                        label: label,
                        quality: template.quality,
                        confidence: score,
                        root: rootName
                    )
                }
            }
        }
        
        return bestChord
    }
    
    private func computeChordScore(chroma: [Double], template: ChordTemplate, root: Int, key: Key) -> Double {
        // Transpose template to root
        let templateChroma = transposeTemplate(template.chromaVector(), toRoot: root)
        
        // Compute correlation score
        let correlationScore = correlation(chroma, templateChroma)
        
        // Apply template weight
        let weightedScore = correlationScore * template.weight
        
        // Apply contextual boost for diatonic chords
        let rootName = keyDetector.getEnharmonicSpelling(noteClass: root, in: key)
        let contextBoost = keyDetector.isDiatonic(chordRoot: rootName, quality: template.quality, in: key) ? contextWeight : 0.0
        
        return max(0.0, weightedScore + contextBoost)
    }
    
    private func transposeTemplate(_ template: [Double], toRoot root: Int) -> [Double] {
        var transposed = Array(repeating: 0.0, count: 12)
        
        for (i, value) in template.enumerated() {
            transposed[(i + root) % 12] = value
        }
        
        return transposed
    }
    
    private func correlation(_ x: [Double], _ y: [Double]) -> Double {
        guard x.count == y.count, x.count > 0 else { return 0.0 }
        
        let n = Double(x.count)
        let meanX = x.reduce(0, +) / n
        let meanY = y.reduce(0, +) / n
        
        var numerator = 0.0
        var denomX = 0.0
        var denomY = 0.0
        
        for i in 0..<x.count {
            let dx = x[i] - meanX
            let dy = y[i] - meanY
            
            numerator += dx * dy
            denomX += dx * dx
            denomY += dy * dy
        }
        
        let denominator = sqrt(denomX * denomY)
        return denominator > 0 ? numerator / denominator : 0.0
    }
    
    private func mergeConsecutiveChords(_ chords: [ChordSpan]) -> [ChordSpan] {
        guard !chords.isEmpty else { return [] }
        
        var merged: [ChordSpan] = []
        var currentChord = chords[0]
        
        for i in 1..<chords.count {
            let nextChord = chords[i]
            
            // Merge if same chord or confidence difference is small (hysteresis)
            if shouldMergeChords(currentChord, nextChord) {
                // Extend current chord
                currentChord = ChordSpan(
                    start: currentChord.start,
                    end: nextChord.end,
                    label: currentChord.label,
                    quality: currentChord.quality,
                    confidence: max(currentChord.confidence, nextChord.confidence),
                    root: currentChord.root,
                    bass: currentChord.bass
                )
            } else {
                merged.append(currentChord)
                currentChord = nextChord
            }
        }
        
        merged.append(currentChord)
        return merged
    }
    
    private func shouldMergeChords(_ chord1: ChordSpan, _ chord2: ChordSpan) -> Bool {
        // Same chord
        if chord1.label == chord2.label {
            return true
        }
        
        // Hysteresis: prefer to keep current chord if confidence difference is small
        if abs(chord1.confidence - chord2.confidence) < hysteresisThreshold {
            return true
        }
        
        return false
    }
    
    private func quantizeChordDurations(_ chords: [ChordSpan]) -> [ChordSpan] {
        return chords.compactMap { chord in
            // Filter out chords that are too short
            if chord.duration >= minChordDuration {
                return chord
            }
            return nil
        }
    }
    
    private func formatChordLabel(root: String, quality: ChordQuality) -> String {
        switch quality {
        case .major:
            return root
        case .minor:
            return "\(root)m"
        case .diminished:
            return "\(root)°"
        case .augmented:
            return "\(root)+"
        case .major7:
            return "\(root)maj7"
        case .minor7:
            return "\(root)m7"
        case .dominant7:
            return "\(root)7"
        case .minorSeven5:
            return "\(root)m7♭5"
        case .suspended2:
            return "\(root)sus2"
        case .suspended4:
            return "\(root)sus4"
        case .add9:
            return "\(root)add9"
        case .sixth:
            return "\(root)6"
        case .ninth:
            return "\(root)9"
        case .eleventh:
            return "\(root)11"
        case .thirteenth:
            return "\(root)13"
        }
    }
}

// MARK: - Extensions

extension ChordDetector {
    /// Detect secondary dominants and borrowed chords
    public func detectAdvancedHarmonies(chords: [ChordSpan], key: Key) -> [ChordSpan] {
        return chords.map { chord in
            let enhancedLabel = enhanceChordLabel(chord, in: key)
            
            return ChordSpan(
                start: chord.start,
                end: chord.end,
                label: enhancedLabel,
                quality: chord.quality,
                confidence: chord.confidence,
                root: chord.root,
                bass: chord.bass
            )
        }
    }
    
    private func enhanceChordLabel(_ chord: ChordSpan, in key: Key) -> String {
        let rootName = chord.root
        let quality = chord.quality
        
        // Check for secondary dominants (V/x)
        if quality == .dominant7 {
            if let target = getSecondaryDominantTarget(root: rootName, in: key) {
                return "\(chord.label)/\(target)"
            }
        }
        
        // Check for borrowed chords
        if !keyDetector.isDiatonic(chordRoot: rootName, quality: quality, in: key) {
            return chord.label // Keep original for now
        }
        
        return chord.label
    }
    
    private func getSecondaryDominantTarget(root: String, in key: Key) -> String? {
        let scaleDegrees = keyDetector.getScaleDegrees(for: key)
        
        // Find what this dominant chord resolves to
        let chromaticNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        
        guard let rootIndex = chromaticNotes.firstIndex(of: root) else { return nil }
        
        // Perfect fifth down = target
        let targetIndex = (rootIndex + 7) % 12
        let targetNote = chromaticNotes[targetIndex]
        
        // Check if target is in scale
        if scaleDegrees.contains(targetNote) {
            return targetNote
        }
        
        return nil
    }
}