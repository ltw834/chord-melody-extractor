import Foundation

/// Key detection using Krumhansl-Schmuckler profiles and chroma analysis
public final class KeyDetector {
    
    // MARK: - Krumhansl-Schmuckler Key Profiles
    
    /// Major key profile weights (C major)
    private static let majorProfile: [Double] = [
        6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
    ]
    
    /// Minor key profile weights (A minor)
    private static let minorProfile: [Double] = [
        6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
    ]
    
    /// All possible key names with their preferred enharmonic spellings
    private static let majorKeyNames = [
        "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"
    ]
    
    private static let minorKeyNames = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"
    ]
    
    /// Flat keys prefer flat accidentals
    private static let flatKeys = Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"])
    
    /// Sharp keys prefer sharp accidentals  
    private static let sharpKeys = Set(["G", "D", "A", "E", "B", "F#", "C#"])
    
    public init() {}
    
    // MARK: - Public Methods
    
    /// Detect key from chroma features
    public func detectKey(from chromaFrames: [[Float]]) -> Key {
        guard !chromaFrames.isEmpty else {
            return Key(tonic: "C", mode: "major")
        }
        
        // Average chroma across all frames
        let avgChroma = averageChroma(chromaFrames)
        
        // Find best matching key
        let (bestKey, bestScore) = findBestKey(avgChroma)
        
        print("Key detection: \(bestKey.displayName) (score: \(String(format: "%.3f", bestScore)))")
        
        return bestKey
    }
    
    /// Detect key from a single chroma vector
    public func detectKey(from chroma: [Float]) -> Key {
        let (bestKey, _) = findBestKey(chroma.map(Double.init))
        return bestKey
    }
    
    /// Get enharmonic spelling for note based on key context
    public func getEnharmonicSpelling(noteClass: Int, in key: Key) -> String {
        let baseNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        let flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
        
        let keyTonic = key.tonic
        
        if Self.flatKeys.contains(keyTonic) {
            return flatNames[noteClass % 12]
        } else if Self.sharpKeys.contains(keyTonic) {
            return baseNames[noteClass % 12]
        } else {
            // Default to naturals/sharps for C major/minor
            return baseNames[noteClass % 12]
        }
    }
    
    /// Analyze key stability over time
    public func analyzeKeyStability(chromaFrames: [[Float]], windowSize: Int = 8) -> [KeyAnalysis] {
        var analyses: [KeyAnalysis] = []
        let hopSize = max(1, windowSize / 2)
        
        var windowStart = 0
        while windowStart + windowSize <= chromaFrames.count {
            let window = Array(chromaFrames[windowStart..<windowStart + windowSize])
            let avgChroma = averageChroma(window)
            
            let (key, score) = findBestKey(avgChroma)
            let stability = computeStability(avgChroma)
            
            let analysis = KeyAnalysis(
                key: key,
                confidence: score,
                stability: stability,
                startFrame: windowStart,
                endFrame: windowStart + windowSize
            )
            
            analyses.append(analysis)
            windowStart += hopSize
        }
        
        return analyses
    }
    
    // MARK: - Private Methods
    
    private func averageChroma(_ chromaFrames: [[Float]]) -> [Double] {
        guard !chromaFrames.isEmpty,
              let firstFrame = chromaFrames.first else {
            return Array(repeating: 0.0, count: 12)
        }
        
        var avgChroma = Array(repeating: 0.0, count: firstFrame.count)
        
        for frame in chromaFrames {
            for (i, value) in frame.enumerated() {
                avgChroma[i] += Double(value)
            }
        }
        
        let frameCount = Double(chromaFrames.count)
        for i in 0..<avgChroma.count {
            avgChroma[i] /= frameCount
        }
        
        return normalizeChroma(avgChroma)
    }
    
    private func findBestKey(_ chroma: [Double]) -> (Key, Double) {
        guard chroma.count == 12 else {
            return (Key(tonic: "C", mode: "major"), 0.0)
        }
        
        var bestKey = Key(tonic: "C", mode: "major")
        var bestScore = -Double.infinity
        
        // Test all major keys
        for tonic in 0..<12 {
            let score = computeKeyScore(chroma, profile: Self.majorProfile, tonic: tonic)
            if score > bestScore {
                bestScore = score
                bestKey = Key(tonic: Self.majorKeyNames[tonic], mode: "major")
            }
        }
        
        // Test all minor keys
        for tonic in 0..<12 {
            let score = computeKeyScore(chroma, profile: Self.minorProfile, tonic: tonic)
            if score > bestScore {
                bestScore = score
                bestKey = Key(tonic: Self.minorKeyNames[tonic], mode: "minor")
            }
        }
        
        return (bestKey, bestScore)
    }
    
    private func computeKeyScore(_ chroma: [Double], profile: [Double], tonic: Int) -> Double {
        // Transpose profile to match tonic
        var transposedProfile = Array(repeating: 0.0, count: 12)
        for i in 0..<12 {
            transposedProfile[i] = profile[(i - tonic + 12) % 12]
        }
        
        // Compute correlation between chroma and profile
        return correlation(chroma, transposedProfile)
    }
    
    private func correlation(_ x: [Double], _ y: [Double]) -> Double {
        guard x.count == y.count else { return 0.0 }
        
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
    
    private func normalizeChroma(_ chroma: [Double]) -> [Double] {
        let sum = chroma.reduce(0, +)
        guard sum > 0 else { return chroma }
        
        return chroma.map { $0 / sum }
    }
    
    private func computeStability(_ chroma: [Double]) -> Double {
        // Stability based on how concentrated the chroma is
        let entropy = chroma.compactMap { value -> Double? in
            value > 0 ? -value * log2(value) : nil
        }.reduce(0, +)
        
        let maxEntropy = log2(12.0) // Maximum possible entropy for 12 bins
        return 1.0 - (entropy / maxEntropy) // Higher stability = lower entropy
    }
}

// MARK: - Key Analysis Structure

public struct KeyAnalysis {
    public let key: Key
    public let confidence: Double
    public let stability: Double
    public let startFrame: Int
    public let endFrame: Int
    
    public init(key: Key, confidence: Double, stability: Double, startFrame: Int, endFrame: Int) {
        self.key = key
        self.confidence = confidence
        self.stability = stability
        self.startFrame = startFrame
        self.endFrame = endFrame
    }
}

// MARK: - Extensions

extension KeyDetector {
    /// Get scale degrees for a given key
    public func getScaleDegrees(for key: Key) -> [String] {
        let chromaticNotes: [String]
        
        if Self.flatKeys.contains(key.tonic) {
            chromaticNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
        } else {
            chromaticNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        }
        
        guard let tonicIndex = chromaticNotes.firstIndex(of: key.tonic) else {
            return []
        }
        
        let intervals: [Int]
        if key.isMajor {
            intervals = [0, 2, 4, 5, 7, 9, 11] // Major scale intervals
        } else {
            intervals = [0, 2, 3, 5, 7, 8, 10] // Natural minor scale intervals
        }
        
        return intervals.map { interval in
            chromaticNotes[(tonicIndex + interval) % 12]
        }
    }
    
    /// Check if a chord is diatonic to the key
    public func isDiatonic(chordRoot: String, quality: ChordQuality, in key: Key) -> Bool {
        let scaleDegrees = getScaleDegrees(for: key)
        
        guard scaleDegrees.contains(chordRoot) else {
            return false
        }
        
        // Additional logic could check if the chord quality matches the expected
        // quality for that scale degree in the given key
        return true
    }
    
    /// Get expected chord quality for scale degree in key
    public func expectedChordQuality(scaleDegree: Int, in key: Key) -> ChordQuality {
        if key.isMajor {
            switch scaleDegree % 7 {
            case 0, 3, 4: return .major // I, IV, V
            case 1, 2, 5: return .minor // ii, iii, vi
            case 6: return .diminished // vii°
            default: return .major
            }
        } else {
            switch scaleDegree % 7 {
            case 0, 3, 4: return .minor // i, iv, v
            case 2, 5, 6: return .major // III, VI, VII
            case 1: return .diminished // ii°
            default: return .minor
            }
        }
    }
}