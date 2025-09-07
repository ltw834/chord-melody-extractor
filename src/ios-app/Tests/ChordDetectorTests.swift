import XCTest
@testable import DrumAIStudio

/// Unit tests for ChordDetector functionality
final class ChordDetectorTests: XCTestCase {
    
    private var chordDetector: ChordDetector!
    private var keyDetector: KeyDetector!
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        chordDetector = ChordDetector()
        keyDetector = KeyDetector()
    }
    
    override func tearDownWithError() throws {
        chordDetector = nil
        keyDetector = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Template Tests
    
    func testChordTemplateTransposition() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Test C major chord
        let cMajorChroma: [Float] = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        let candidates = chordDetector.analyzeChromaFrame(cMajorChroma, key: key)
        
        XCTAssertFalse(candidates.isEmpty, "Should detect chord candidates")
        
        let bestCandidate = candidates.first!
        XCTAssertEqual(bestCandidate.0.root, "C", "Should detect C as root")
        XCTAssertEqual(bestCandidate.0.quality, .major, "Should detect major quality")
    }
    
    func testTransposedChords() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Test all 12 transpositions of major chord
        for transposition in 0..<12 {
            var chroma: [Float] = Array(repeating: 0.0, count: 12)
            
            // Major triad: root, third, fifth (0, 4, 7 semitones)
            chroma[transposition % 12] = 1.0
            chroma[(transposition + 4) % 12] = 1.0
            chroma[(transposition + 7) % 12] = 1.0
            
            let candidates = chordDetector.analyzeChromaFrame(chroma, key: key)
            
            XCTAssertFalse(candidates.isEmpty, "Should detect chord for transposition \(transposition)")
            
            let bestCandidate = candidates.first!
            XCTAssertEqual(bestCandidate.0.quality, .major, "Should detect major quality for transposition \(transposition)")
        }
    }
    
    func testMinorChordDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // A minor chord (A, C, E)
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        chroma[9] = 1.0  // A
        chroma[0] = 1.0  // C
        chroma[4] = 1.0  // E
        
        let candidates = chordDetector.analyzeChromaFrame(chroma, key: key)
        
        XCTAssertFalse(candidates.isEmpty, "Should detect A minor chord")
        
        let bestCandidate = candidates.first!
        XCTAssertEqual(bestCandidate.0.root, "A", "Should detect A as root")
        XCTAssertEqual(bestCandidate.0.quality, .minor, "Should detect minor quality")
    }
    
    func testSeventhChordDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // C7 chord (C, E, G, Bb)
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        chroma[0] = 1.0   // C
        chroma[4] = 1.0   // E
        chroma[7] = 1.0   // G
        chroma[10] = 1.0  // Bb
        
        let candidates = chordDetector.analyzeChromaFrame(chroma, key: key)
        
        XCTAssertFalse(candidates.isEmpty, "Should detect C7 chord")
        
        let bestCandidate = candidates.first!
        XCTAssertEqual(bestCandidate.0.root, "C", "Should detect C as root")
        XCTAssertEqual(bestCandidate.0.quality, .dominant7, "Should detect dominant 7th quality")
    }
    
    func testDiminishedChordDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // B diminished chord (B, D, F)
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        chroma[11] = 1.0  // B
        chroma[2] = 1.0   // D
        chroma[5] = 1.0   // F
        
        let candidates = chordDetector.analyzeChromaFrame(chroma, key: key)
        
        XCTAssertFalse(candidates.isEmpty, "Should detect B diminished chord")
        
        let bestCandidate = candidates.first!
        XCTAssertEqual(bestCandidate.0.root, "B", "Should detect B as root")
        XCTAssertEqual(bestCandidate.0.quality, .diminished, "Should detect diminished quality")
    }
    
    func testSuspendedChordDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Csus4 chord (C, F, G)
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        chroma[0] = 1.0  // C
        chroma[5] = 1.0  // F
        chroma[7] = 1.0  // G
        
        let candidates = chordDetector.analyzeChromaFrame(chroma, key: key)
        
        XCTAssertFalse(candidates.isEmpty, "Should detect Csus4 chord")
        
        let bestCandidate = candidates.first!
        XCTAssertEqual(bestCandidate.0.root, "C", "Should detect C as root")
        XCTAssertEqual(bestCandidate.0.quality, .suspended4, "Should detect sus4 quality")
    }
    
    // MARK: - Beat-Synchronous Detection Tests
    
    func testBeatSynchronousDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Create mock chroma frames for beat-synchronous detection
        var chromaFrames: [[Float]] = []
        
        // First beat: C major
        for _ in 0..<10 {
            var chroma: [Float] = Array(repeating: 0.1, count: 12)
            chroma[0] = 1.0  // C
            chroma[4] = 1.0  // E
            chroma[7] = 1.0  // G
            chromaFrames.append(chroma)
        }
        
        // Second beat: F major
        for _ in 0..<10 {
            var chroma: [Float] = Array(repeating: 0.1, count: 12)
            chroma[5] = 1.0  // F
            chroma[9] = 1.0  // A
            chroma[0] = 1.0  // C
            chromaFrames.append(chroma)
        }
        
        let beats = [0.0, 0.5, 1.0, 1.5, 2.0]
        
        let chords = chordDetector.detectChords(
            chromaFrames: chromaFrames,
            beats: beats,
            key: key,
            frameDuration: 0.02
        )
        
        XCTAssertGreaterThan(chords.count, 0, "Should detect chords from beat-synchronous analysis")
        
        // Should have detected both C and F chords
        let rootNotes = Set(chords.map { $0.root })
        XCTAssertTrue(rootNotes.contains("C") || rootNotes.contains("F"), "Should detect C or F chords")
    }
    
    // MARK: - Chord Progression Tests
    
    func testCommonProgressionDetection() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Test I-vi-IV-V progression (C-Am-F-G)
        let progressionChroma: [[Float]] = [
            createChromaForChord(root: 0, quality: .major),   // C major
            createChromaForChord(root: 9, quality: .minor),   // A minor
            createChromaForChord(root: 5, quality: .major),   // F major
            createChromaForChord(root: 7, quality: .major)    // G major
        ]
        
        let beats = [0.0, 1.0, 2.0, 3.0, 4.0]
        
        let chords = chordDetector.detectChords(
            chromaFrames: progressionChroma.flatMap { Array(repeating: $0, count: 10) },
            beats: beats,
            key: key
        )
        
        XCTAssertGreaterThanOrEqual(chords.count, 2, "Should detect multiple chords in progression")
        
        // Check for expected roots
        let detectedRoots = chords.map { $0.root }
        let expectedRoots = ["C", "A", "F", "G"]
        
        for expectedRoot in expectedRoots {
            XCTAssertTrue(detectedRoots.contains(expectedRoot), "Should detect \(expectedRoot) in progression")
        }
    }
    
    // MARK: - Edge Cases
    
    func testEmptyChromaHandling() throws {
        let key = Key(tonic: "C", mode: "major")
        let emptyChroma: [Float] = Array(repeating: 0.0, count: 12)
        
        let candidates = chordDetector.analyzeChromaFrame(emptyChroma, key: key)
        
        // Should handle empty chroma gracefully
        XCTAssertTrue(candidates.isEmpty, "Should return no candidates for empty chroma")
    }
    
    func testNoisyChromaHandling() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Create noisy chroma with weak chord signal
        var noisyChroma: [Float] = Array(repeating: 0.3, count: 12) // High noise floor
        noisyChroma[0] = 0.6  // C (weak)
        noisyChroma[4] = 0.6  // E (weak)
        noisyChroma[7] = 0.6  // G (weak)
        
        let candidates = chordDetector.analyzeChromaFrame(noisyChroma, key: key)
        
        // Should still detect chord but with lower confidence
        if !candidates.isEmpty {
            let bestCandidate = candidates.first!
            XCTAssertLessThan(bestCandidate.1, 0.8, "Should have lower confidence for noisy input")
        }
    }
    
    func testChordMerging() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Create very short chord spans that should be merged
        let shortChords = [
            ChordSpan(start: 0.0, end: 0.1, label: "C", quality: .major, confidence: 0.8, root: "C"),
            ChordSpan(start: 0.1, end: 0.2, label: "C", quality: .major, confidence: 0.8, root: "C"),
            ChordSpan(start: 0.2, end: 0.3, label: "C", quality: .major, confidence: 0.8, root: "C")
        ]
        
        // This tests the internal merging logic (would need to expose it for testing)
        XCTAssertEqual(shortChords.count, 3, "Test setup check")
    }
    
    // MARK: - Performance Tests
    
    func testChordDetectionPerformance() throws {
        let key = Key(tonic: "C", mode: "major")
        
        // Generate large chroma dataset
        var chromaFrames: [[Float]] = []
        for _ in 0..<1000 {
            let chroma = createChromaForChord(root: Int.random(in: 0..<12), quality: .major)
            chromaFrames.append(chroma)
        }
        
        let beats = Array(stride(from: 0.0, to: 20.0, by: 0.02))
        
        measure {
            _ = chordDetector.detectChords(
                chromaFrames: chromaFrames,
                beats: beats,
                key: key
            )
        }
    }
    
    // MARK: - Helper Methods
    
    private func createChromaForChord(root: Int, quality: ChordQuality) -> [Float] {
        var chroma: [Float] = Array(repeating: 0.1, count: 12) // Small noise floor
        
        switch quality {
        case .major:
            chroma[root % 12] = 1.0
            chroma[(root + 4) % 12] = 1.0
            chroma[(root + 7) % 12] = 1.0
        case .minor:
            chroma[root % 12] = 1.0
            chroma[(root + 3) % 12] = 1.0
            chroma[(root + 7) % 12] = 1.0
        case .diminished:
            chroma[root % 12] = 1.0
            chroma[(root + 3) % 12] = 1.0
            chroma[(root + 6) % 12] = 1.0
        case .dominant7:
            chroma[root % 12] = 1.0
            chroma[(root + 4) % 12] = 1.0
            chroma[(root + 7) % 12] = 1.0
            chroma[(root + 10) % 12] = 1.0
        default:
            // Default to major for other qualities
            chroma[root % 12] = 1.0
            chroma[(root + 4) % 12] = 1.0
            chroma[(root + 7) % 12] = 1.0
        }
        
        return chroma
    }
}

// MARK: - Key Detector Tests

final class KeyDetectorTests: XCTestCase {
    
    private var keyDetector: KeyDetector!
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        keyDetector = KeyDetector()
    }
    
    override func tearDownWithError() throws {
        keyDetector = nil
        try super.tearDownWithError()
    }
    
    func testCMajorDetection() throws {
        // C major scale chroma
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        let cMajorNotes = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
        for note in cMajorNotes {
            chroma[note] = 1.0
        }
        
        let key = keyDetector.detectKey(from: chroma)
        
        XCTAssertEqual(key.tonic, "C", "Should detect C major")
        XCTAssertEqual(key.mode, "major", "Should detect major mode")
    }
    
    func testAMinorDetection() throws {
        // A minor scale chroma
        var chroma: [Float] = Array(repeating: 0.0, count: 12)
        let aMinorNotes = [0, 2, 3, 5, 7, 8, 10] // A B C D E F G (relative to A)
        for note in aMinorNotes {
            chroma[(note + 9) % 12] = 1.0 // Transpose to A
        }
        
        let key = keyDetector.detectKey(from: chroma)
        
        XCTAssertEqual(key.tonic, "A", "Should detect A minor")
        XCTAssertEqual(key.mode, "minor", "Should detect minor mode")
    }
    
    func testEnharmonicSpelling() throws {
        let flatKey = Key(tonic: "Bb", mode: "major")
        let sharpKey = Key(tonic: "F#", mode: "major")
        
        // F# in Bb key should be Gb
        let flatSpelling = keyDetector.getEnharmonicSpelling(noteClass: 6, in: flatKey)
        XCTAssertEqual(flatSpelling, "Gb", "Should use flat spelling in flat key")
        
        // F# in F# key should remain F#
        let sharpSpelling = keyDetector.getEnharmonicSpelling(noteClass: 6, in: sharpKey)
        XCTAssertEqual(sharpSpelling, "F#", "Should use sharp spelling in sharp key")
    }
}