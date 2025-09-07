import Foundation
import AVFoundation
import Accelerate

/// Melody extraction using YIN-based pitch tracking and note segmentation
public final class MelodyExtractor {
    
    // MARK: - Configuration
    private let sampleRate: Double = 44100
    private let frameSize: Int = 2048
    private let hopSize: Int = 512
    private let yinThreshold: Float = 0.15
    private let minFrequency: Double = 80.0  // ~E2
    private let maxFrequency: Double = 2000.0 // ~B6
    private let minNoteDuration: Double = 0.08 // 80ms minimum note length
    private let voicingThreshold: Float = 0.3 // Threshold for voiced vs unvoiced
    
    // MARK: - Private Properties
    private var yinBuffer: [Float]
    private var autocorrelationBuffer: [Float]
    private var cumulativeMeanBuffer: [Float]
    
    public init() {
        yinBuffer = Array(repeating: 0, count: frameSize)
        autocorrelationBuffer = Array(repeating: 0, count: frameSize / 2)
        cumulativeMeanBuffer = Array(repeating: 0, count: frameSize / 2)
    }
    
    // MARK: - Public Methods
    
    /// Extract melody from audio buffer
    public func extractMelody(from buffer: AVAudioPCMBuffer) -> [MelodyNote] {
        guard let channelData = buffer.floatChannelData?[0] else { return [] }
        
        let frameCount = Int(buffer.frameLength)
        let audioData = Array(UnsafeBufferPointer(start: channelData, count: frameCount))
        
        return extractMelody(from: audioData)
    }
    
    /// Extract melody from audio data
    public func extractMelody(from audioData: [Float]) -> [MelodyNote] {
        // Step 1: Extract fundamental frequency for each frame
        let f0Track = extractF0Track(audioData)
        
        // Step 2: Convert F0 to MIDI notes with voicing detection
        let pitchTrack = f0TrackToPitches(f0Track)
        
        // Step 3: Segment into discrete notes
        let notes = segmentIntoNotes(pitchTrack)
        
        // Step 4: Filter and refine notes
        let refinedNotes = refineNotes(notes)
        
        print("Extracted \(refinedNotes.count) melody notes")
        
        return refinedNotes
    }
    
    /// Extract F0 track using YIN algorithm
    public func extractF0Track(_ audioData: [Float]) -> [F0Point] {
        var f0Track: [F0Point] = []
        let hopCount = (audioData.count - frameSize) / hopSize + 1
        
        for hop in 0..<hopCount {
            let startIndex = hop * hopSize
            let endIndex = min(startIndex + frameSize, audioData.count)
            
            if endIndex - startIndex == frameSize {
                let frame = Array(audioData[startIndex..<endIndex])
                let timeSeconds = Double(hop * hopSize) / sampleRate
                
                let (f0, confidence) = yinPitchDetection(frame)
                
                f0Track.append(F0Point(
                    time: timeSeconds,
                    frequency: f0,
                    confidence: confidence,
                    voiced: confidence > voicingThreshold && f0 > minFrequency && f0 < maxFrequency
                ))
            }
        }
        
        return f0Track
    }
    
    // MARK: - Private Methods - YIN Algorithm
    
    private func yinPitchDetection(_ frame: [Float]) -> (frequency: Double, confidence: Float) {
        guard frame.count == frameSize else {
            return (0.0, 0.0)
        }
        
        // Step 1: Autocorrelation
        computeAutocorrelation(frame)
        
        // Step 2: Cumulative mean normalized difference
        computeCumulativeMeanNormalizedDifference()
        
        // Step 3: Absolute threshold
        guard let tau = findAbsoluteThreshold() else {
            return (0.0, 0.0)
        }
        
        // Step 4: Parabolic interpolation
        let (interpolatedTau, confidence) = parabolicInterpolation(tau)
        
        // Convert tau to frequency
        let frequency = sampleRate / Double(interpolatedTau)
        
        return (frequency, confidence)
    }
    
    private func computeAutocorrelation(_ frame: [Float]) {
        // Autocorrelation using difference function (more efficient than standard autocorrelation)
        let halfSize = frameSize / 2
        
        for tau in 0..<halfSize {
            var sum: Float = 0.0
            
            for j in 0..<halfSize {
                let diff = frame[j] - frame[j + tau]
                sum += diff * diff
            }
            
            autocorrelationBuffer[tau] = sum
        }
    }
    
    private func computeCumulativeMeanNormalizedDifference() {
        cumulativeMeanBuffer[0] = 1.0
        
        for tau in 1..<autocorrelationBuffer.count {
            var sum: Float = 0.0
            
            for j in 1...tau {
                sum += autocorrelationBuffer[j]
            }
            
            let mean = sum / Float(tau)
            cumulativeMeanBuffer[tau] = mean > 0 ? autocorrelationBuffer[tau] / mean : 1.0
        }
    }
    
    private func findAbsoluteThreshold() -> Int? {
        let minTau = Int(sampleRate / maxFrequency)
        let maxTau = Int(sampleRate / minFrequency)
        
        for tau in minTau..<min(maxTau, cumulativeMeanBuffer.count) {
            if cumulativeMeanBuffer[tau] < yinThreshold {
                // Find local minimum after threshold crossing
                var minTau = tau
                var minValue = cumulativeMeanBuffer[tau]
                
                for searchTau in (tau + 1)..<min(tau + 10, cumulativeMeanBuffer.count) {
                    if cumulativeMeanBuffer[searchTau] < minValue {
                        minValue = cumulativeMeanBuffer[searchTau]
                        minTau = searchTau
                    } else {
                        break // Stop at local minimum
                    }
                }
                
                return minTau
            }
        }
        
        return nil
    }
    
    private func parabolicInterpolation(_ tau: Int) -> (tau: Double, confidence: Float) {
        guard tau > 0 && tau < cumulativeMeanBuffer.count - 1 else {
            return (Double(tau), 1.0 - cumulativeMeanBuffer[tau])
        }
        
        let y1 = cumulativeMeanBuffer[tau - 1]
        let y2 = cumulativeMeanBuffer[tau]
        let y3 = cumulativeMeanBuffer[tau + 1]
        
        let a = (y1 - 2*y2 + y3) / 2
        let b = (y3 - y1) / 2
        
        let interpolatedTau: Double
        if abs(a) > 1e-10 {
            let offset = -b / (2 * a)
            interpolatedTau = Double(tau) + Double(offset)
        } else {
            interpolatedTau = Double(tau)
        }
        
        let confidence = 1.0 - y2 // Higher confidence = lower normalized difference
        
        return (interpolatedTau, confidence)
    }
    
    // MARK: - Private Methods - Note Segmentation
    
    private func f0TrackToPitches(_ f0Track: [F0Point]) -> [PitchPoint] {
        return f0Track.map { f0Point in
            let midi: Int?
            
            if f0Point.voiced {
                // Convert frequency to MIDI note number
                let midiFloat = 12.0 * log2(f0Point.frequency / 440.0) + 69.0
                midi = Int(round(midiFloat))
            } else {
                midi = nil
            }
            
            return PitchPoint(
                time: f0Point.time,
                midi: midi,
                confidence: f0Point.confidence,
                voiced: f0Point.voiced
            )
        }
    }
    
    private func segmentIntoNotes(_ pitchTrack: [PitchPoint]) -> [MelodyNote] {
        guard !pitchTrack.isEmpty else { return [] }
        
        var notes: [MelodyNote] = []
        var currentNote: MelodyNote?
        
        for pitchPoint in pitchTrack {
            if let midi = pitchPoint.midi, pitchPoint.voiced {
                // Voiced frame with valid MIDI
                
                if let current = currentNote {
                    if current.midi == midi {
                        // Continue current note
                        currentNote = MelodyNote(
                            start: current.start,
                            end: pitchPoint.time,
                            midi: midi,
                            confidence: max(current.confidence, Double(pitchPoint.confidence)),
                            velocity: current.velocity
                        )
                    } else {
                        // Different pitch, finish current note and start new one
                        notes.append(current)
                        currentNote = MelodyNote(
                            start: pitchPoint.time,
                            end: pitchPoint.time,
                            midi: midi,
                            confidence: Double(pitchPoint.confidence),
                            velocity: velocityFromConfidence(pitchPoint.confidence)
                        )
                    }
                } else {
                    // Start new note
                    currentNote = MelodyNote(
                        start: pitchPoint.time,
                        end: pitchPoint.time,
                        midi: midi,
                        confidence: Double(pitchPoint.confidence),
                        velocity: velocityFromConfidence(pitchPoint.confidence)
                    )
                }
            } else {
                // Unvoiced frame, finish current note if any
                if let current = currentNote {
                    notes.append(current)
                    currentNote = nil
                }
            }
        }
        
        // Add final note if any
        if let current = currentNote {
            notes.append(current)
        }
        
        return notes
    }
    
    private func refineNotes(_ notes: [MelodyNote]) -> [MelodyNote] {
        // Filter notes that are too short
        let filteredNotes = notes.filter { $0.duration >= minNoteDuration }
        
        // Merge very close notes of the same pitch
        let mergedNotes = mergeCloseNotes(filteredNotes)
        
        // Remove outliers (notes that are very different from neighboring notes)
        let cleanedNotes = removeOutliers(mergedNotes)
        
        return cleanedNotes
    }
    
    private func mergeCloseNotes(_ notes: [MelodyNote]) -> [MelodyNote] {
        guard notes.count > 1 else { return notes }
        
        var merged: [MelodyNote] = []
        var current = notes[0]
        
        for i in 1..<notes.count {
            let next = notes[i]
            
            // Merge if same MIDI note and gap is small
            if current.midi == next.midi && next.start - current.end < 0.05 {
                current = MelodyNote(
                    start: current.start,
                    end: next.end,
                    midi: current.midi,
                    confidence: max(current.confidence, next.confidence),
                    velocity: max(current.velocity, next.velocity)
                )
            } else {
                merged.append(current)
                current = next
            }
        }
        
        merged.append(current)
        return merged
    }
    
    private func removeOutliers(_ notes: [MelodyNote]) -> [MelodyNote] {
        guard notes.count > 2 else { return notes }
        
        var cleaned: [MelodyNote] = [notes[0]]
        
        for i in 1..<notes.count - 1 {
            let prev = notes[i - 1]
            let current = notes[i]
            let next = notes[i + 1]
            
            // Check if current note is an outlier
            let prevInterval = abs(current.midi - prev.midi)
            let nextInterval = abs(next.midi - current.midi)
            
            // If both intervals are large (> octave), might be an outlier
            if prevInterval <= 12 || nextInterval <= 12 {
                cleaned.append(current)
            }
            // Otherwise skip this note (remove outlier)
        }
        
        cleaned.append(notes.last!)
        return cleaned
    }
    
    private func velocityFromConfidence(_ confidence: Float) -> Int {
        // Map confidence (0-1) to MIDI velocity (20-120)
        let normalizedConfidence = max(0.0, min(1.0, confidence))
        return Int(20 + normalizedConfidence * 100)
    }
}

// MARK: - Supporting Data Structures

private struct F0Point {
    let time: Double
    let frequency: Double
    let confidence: Float
    let voiced: Bool
}

private struct PitchPoint {
    let time: Double
    let midi: Int?
    let confidence: Float
    let voiced: Bool
}

// MARK: - Extensions

extension MelodyExtractor {
    /// Extract melody statistics for analysis
    public func extractMelodyStatistics(_ melody: [MelodyNote]) -> MelodyStatistics {
        guard !melody.isEmpty else {
            return MelodyStatistics.empty()
        }
        
        let midiNotes = melody.map { $0.midi }
        let durations = melody.map { $0.duration }
        
        let minPitch = midiNotes.min() ?? 60
        let maxPitch = midiNotes.max() ?? 60
        let avgPitch = Double(midiNotes.reduce(0, +)) / Double(midiNotes.count)
        
        let minDuration = durations.min() ?? 0.0
        let maxDuration = durations.max() ?? 0.0
        let avgDuration = durations.reduce(0, +) / Double(durations.count)
        
        let range = maxPitch - minPitch
        let totalDuration = melody.last?.end ?? 0.0 - melody.first?.start ?? 0.0
        
        return MelodyStatistics(
            noteCount: melody.count,
            pitchRange: range,
            minPitch: minPitch,
            maxPitch: maxPitch,
            avgPitch: avgPitch,
            minDuration: minDuration,
            maxDuration: maxDuration,
            avgDuration: avgDuration,
            totalDuration: totalDuration
        )
    }
}

public struct MelodyStatistics {
    public let noteCount: Int
    public let pitchRange: Int // Semitones
    public let minPitch: Int
    public let maxPitch: Int
    public let avgPitch: Double
    public let minDuration: Double
    public let maxDuration: Double
    public let avgDuration: Double
    public let totalDuration: Double
    
    static func empty() -> MelodyStatistics {
        return MelodyStatistics(
            noteCount: 0,
            pitchRange: 0,
            minPitch: 60,
            maxPitch: 60,
            avgPitch: 60.0,
            minDuration: 0.0,
            maxDuration: 0.0,
            avgDuration: 0.0,
            totalDuration: 0.0
        )
    }
}