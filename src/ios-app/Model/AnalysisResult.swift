import Foundation

// MARK: - Main Analysis Result

/// Complete analysis result containing all extracted musical features
public struct AnalysisResult: Codable, Sendable {
    public let tempo: Double
    public let timeSig: TimeSig
    public let key: Key
    public let beats: [Double]
    public let bars: [Bar]
    public let chords: [ChordSpan]
    public let melody: [MelodyNote]
    public let dynamics: [DynamicsPoint]
    public let duration: Double
    
    public init(
        tempo: Double,
        timeSig: TimeSig,
        key: Key,
        beats: [Double],
        bars: [Bar],
        chords: [ChordSpan],
        melody: [MelodyNote],
        dynamics: [DynamicsPoint],
        duration: Double
    ) {
        self.tempo = tempo
        self.timeSig = timeSig
        self.key = key
        self.beats = beats
        self.bars = bars
        self.chords = chords
        self.melody = melody
        self.dynamics = dynamics
        self.duration = duration
    }
    
    /// Empty analysis result for initialization
    public static func empty() -> AnalysisResult {
        return AnalysisResult(
            tempo: 120.0,
            timeSig: TimeSig(numerator: 4, denominator: 4),
            key: Key(tonic: "C", mode: "major"),
            beats: [],
            bars: [],
            chords: [],
            melody: [],
            dynamics: [],
            duration: 0.0
        )
    }
}

// MARK: - Time Signature

public struct TimeSig: Codable, Sendable, Equatable {
    public let numerator: Int
    public let denominator: Int
    
    public init(numerator: Int, denominator: Int) {
        self.numerator = numerator
        self.denominator = denominator
    }
    
    /// Common time signatures
    public static let fourFour = TimeSig(numerator: 4, denominator: 4)
    public static let threeFour = TimeSig(numerator: 3, denominator: 4)
    public static let sixEight = TimeSig(numerator: 6, denominator: 8)
}

// MARK: - Key

public struct Key: Codable, Sendable, Equatable {
    public let tonic: String
    public let mode: String
    
    public init(tonic: String, mode: String) {
        self.tonic = tonic
        self.mode = mode
    }
    
    /// Display name for key
    public var displayName: String {
        return "\(tonic) \(mode.capitalized)"
    }
    
    /// Whether this is a major key
    public var isMajor: Bool {
        return mode.lowercased() == "major"
    }
    
    /// Whether this is a minor key
    public var isMinor: Bool {
        return mode.lowercased() == "minor"
    }
}

// MARK: - Bar

public struct Bar: Codable, Sendable, Equatable, Identifiable {
    public let id = UUID()
    public let index: Int
    public let start: Double
    public let end: Double
    
    public init(index: Int, start: Double, end: Double) {
        self.index = index
        self.start = start
        self.end = end
    }
    
    /// Duration of the bar in seconds
    public var duration: Double {
        return end - start
    }
}

// MARK: - Chord Types and Quality

public enum ChordQuality: String, Codable, CaseIterable, Sendable {
    case major = "maj"
    case minor = "min"
    case diminished = "dim"
    case augmented = "aug"
    case major7 = "maj7"
    case minor7 = "min7"
    case dominant7 = "7"
    case minorSeven5 = "m7b5"
    case suspended2 = "sus2"
    case suspended4 = "sus4"
    case add9 = "add9"
    case sixth = "6"
    case ninth = "9"
    case eleventh = "11"
    case thirteenth = "13"
    
    /// Display color for chord quality
    public var color: String {
        switch self {
        case .major, .major7: return "#4CAF50" // Green
        case .minor, .minor7: return "#2196F3" // Blue
        case .dominant7: return "#FF9800" // Orange
        case .diminished, .minorSeven5: return "#F44336" // Red
        case .augmented: return "#E91E63" // Pink
        case .suspended2, .suspended4: return "#9C27B0" // Purple
        case .add9, .sixth: return "#00BCD4" // Cyan
        case .ninth, .eleventh, .thirteenth: return "#795548" // Brown
        }
    }
    
    /// Display name for chord quality
    public var displayName: String {
        switch self {
        case .major: return "Major"
        case .minor: return "Minor"
        case .diminished: return "Diminished"
        case .augmented: return "Augmented"
        case .major7: return "Major 7th"
        case .minor7: return "Minor 7th"
        case .dominant7: return "Dominant 7th"
        case .minorSeven5: return "Half-diminished"
        case .suspended2: return "Suspended 2nd"
        case .suspended4: return "Suspended 4th"
        case .add9: return "Add 9"
        case .sixth: return "Sixth"
        case .ninth: return "Ninth"
        case .eleventh: return "Eleventh"
        case .thirteenth: return "Thirteenth"
        }
    }
}

// MARK: - Chord Span

public struct ChordSpan: Codable, Sendable, Equatable, Identifiable {
    public let id = UUID()
    public let start: Double
    public let end: Double
    public let label: String
    public let quality: ChordQuality
    public let confidence: Double
    public let root: String
    public let bass: String?
    
    public init(
        start: Double,
        end: Double,
        label: String,
        quality: ChordQuality,
        confidence: Double,
        root: String,
        bass: String? = nil
    ) {
        self.start = start
        self.end = end
        self.label = label
        self.quality = quality
        self.confidence = confidence
        self.root = root
        self.bass = bass
    }
    
    /// Duration of the chord in seconds
    public var duration: Double {
        return end - start
    }
    
    /// Display label with bass note if present
    public var displayLabel: String {
        if let bass = bass, bass != root {
            return "\(label)/\(bass)"
        }
        return label
    }
    
    /// Whether this chord has a slash bass
    public var hasSlashBass: Bool {
        return bass != nil && bass != root
    }
}

// MARK: - Melody Note

public struct MelodyNote: Codable, Sendable, Equatable, Identifiable {
    public let id = UUID()
    public let start: Double
    public let end: Double
    public let midi: Int
    public let confidence: Double
    public let velocity: Int
    
    public init(
        start: Double,
        end: Double,
        midi: Int,
        confidence: Double = 1.0,
        velocity: Int = 80
    ) {
        self.start = start
        self.end = end
        self.midi = midi
        self.confidence = confidence
        self.velocity = velocity
    }
    
    /// Duration of the note in seconds
    public var duration: Double {
        return end - start
    }
    
    /// Note name (e.g., "C4", "F#5")
    public var noteName: String {
        let noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        let octave = (midi / 12) - 1
        let noteIndex = midi % 12
        return "\(noteNames[noteIndex])\(octave)"
    }
    
    /// Frequency in Hz
    public var frequency: Double {
        return 440.0 * pow(2.0, Double(midi - 69) / 12.0)
    }
}

// MARK: - Dynamics Point

public struct DynamicsPoint: Codable, Sendable, Equatable {
    public let time: Double
    public let rmsDB: Double
    public let velocity: Int
    
    public init(time: Double, rmsDB: Double, velocity: Int = 80) {
        self.time = time
        self.rmsDB = rmsDB
        self.velocity = velocity
    }
    
    /// Dynamic level as a string (pp, p, mp, mf, f, ff)
    public var dynamicLevel: String {
        switch rmsDB {
        case ..<(-40): return "pp"
        case -40..<(-30): return "p"
        case -30..<(-20): return "mp"
        case -20..<(-10): return "mf"
        case -10..<0: return "f"
        default: return "ff"
        }
    }
    
    /// Normalized amplitude (0-1)
    public var normalizedAmplitude: Double {
        return max(0, min(1, (rmsDB + 60) / 60)) // Map -60dB to 0dB → 0 to 1
    }
}

// MARK: - Extensions for UI

extension AnalysisResult {
    /// Get chord at specific time
    public func chord(at time: Double) -> ChordSpan? {
        return chords.first { $0.start <= time && time < $0.end }
    }
    
    /// Get melody notes in time range
    public func melodyNotes(in range: ClosedRange<Double>) -> [MelodyNote] {
        return melody.filter { note in
            note.start < range.upperBound && note.end > range.lowerBound
        }
    }
    
    /// Get dynamics point at specific time
    public func dynamics(at time: Double) -> DynamicsPoint? {
        return dynamics.min { abs($0.time - time) < abs($1.time - time) }
    }
    
    /// Get bar containing specific time
    public func bar(at time: Double) -> Bar? {
        return bars.first { $0.start <= time && time < $0.end }
    }
    
    /// Convert time to bar and beat position
    public func barBeatPosition(at time: Double) -> (bar: Int, beat: Double)? {
        guard let bar = bar(at: time) else { return nil }
        
        let timeInBar = time - bar.start
        let beatDuration = 60.0 / tempo
        let beat = timeInBar / beatDuration
        
        return (bar: bar.index, beat: beat)
    }
}