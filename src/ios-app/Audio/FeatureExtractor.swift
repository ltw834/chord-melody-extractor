import Foundation
import AVFoundation
import Accelerate
import AudioKit
import SoundpipeAudioKit

/// Advanced feature extraction for audio analysis
/// Handles FFT, CQT, chroma, onset detection, beat tracking, and RMS dynamics
public final class FeatureExtractor {
    
    // MARK: - Configuration
    private let sampleRate: Double = 44100
    private let frameSize: Int = 4096
    private let hopSize: Int = 1024
    private let chromaBins: Int = 12
    private let cqtBins: Int = 84 // 7 octaves * 12 semitones
    
    // MARK: - FFT Setup
    private var fftSetup: vDSP_DFT_Setup?
    private var window: [Float]
    private var windowedBuffer: [Float]
    private var complexBuffer: DSPSplitComplex
    
    public init() {
        // Initialize Hann window
        window = Array(0..<frameSize).map { i in
            0.5 * (1.0 - cos(2.0 * .pi * Double(i) / Double(frameSize - 1)))
        }
        
        windowedBuffer = Array(repeating: 0, count: frameSize)
        
        // Setup complex buffer for FFT
        let halfSize = frameSize / 2
        let realBuffer = UnsafeMutablePointer<Float>.allocate(capacity: halfSize)
        let imagBuffer = UnsafeMutablePointer<Float>.allocate(capacity: halfSize)
        complexBuffer = DSPSplitComplex(realp: realBuffer, imagp: imagBuffer)
        
        // Create FFT setup
        fftSetup = vDSP_DFT_zrop_CreateSetup(nil, UInt(frameSize), vDSP_DFT_FORWARD)
    }
    
    deinit {
        if let setup = fftSetup {
            vDSP_DFT_DestroySetup(setup)
        }
        complexBuffer.realp.deallocate()
        complexBuffer.imagp.deallocate()
    }
    
    // MARK: - Public Methods
    
    /// Extract all features from audio buffer
    public func extractFeatures(from buffer: AVAudioPCMBuffer) -> AudioFeatures {
        guard let channelData = buffer.floatChannelData?[0] else {
            return AudioFeatures.empty()
        }
        
        let frameCount = Int(buffer.frameLength)
        let audioData = Array(UnsafeBufferPointer(start: channelData, count: frameCount))
        
        // Extract features
        let spectrum = computeSpectrum(audioData)
        let chroma = computeChroma(spectrum)
        let onsets = detectOnsets(spectrum)
        let tempo = estimateTempo(audioData)
        let beats = estimateBeats(audioData, tempo: tempo)
        let rmsEnvelope = computeRMSEnvelope(audioData)
        
        return AudioFeatures(
            spectrum: spectrum,
            chroma: chroma,
            onsets: onsets,
            tempo: tempo,
            beats: beats,
            rmsEnvelope: rmsEnvelope
        )
    }
    
    /// Compute magnitude spectrum using FFT
    public func computeSpectrum(_ audioData: [Float]) -> [[Float]] {
        var spectrogram: [[Float]] = []
        let hopCount = (audioData.count - frameSize) / hopSize + 1
        
        for hop in 0..<hopCount {
            let startIndex = hop * hopSize
            let endIndex = min(startIndex + frameSize, audioData.count)
            
            if endIndex - startIndex == frameSize {
                let frame = Array(audioData[startIndex..<endIndex])
                let spectrum = computeFrameSpectrum(frame)
                spectrogram.append(spectrum)
            }
        }
        
        return spectrogram
    }
    
    /// Compute chroma features from spectrum
    public func computeChroma(_ spectrogram: [[Float]]) -> [[Float]] {
        var chromaFrames: [[Float]] = []
        
        for spectrum in spectrogram {
            let chroma = spectrumToChroma(spectrum)
            chromaFrames.append(chroma)
        }
        
        return chromaFrames
    }
    
    /// Detect onset events
    public func detectOnsets(_ spectrogram: [[Float]]) -> [Double] {
        guard spectrogram.count > 1 else { return [] }
        
        var onsets: [Double] = []
        var previousSpectrum = spectrogram[0]
        
        for (frameIndex, spectrum) in spectrogram.enumerated().dropFirst() {
            // Spectral flux onset detection
            var flux: Float = 0.0
            
            for (bin, magnitude) in spectrum.enumerated() {
                let diff = magnitude - previousSpectrum[bin]
                if diff > 0 {
                    flux += diff
                }
            }
            
            // Threshold-based onset detection
            if flux > 0.1 { // Adjust threshold as needed
                let timeSeconds = Double(frameIndex * hopSize) / sampleRate
                onsets.append(timeSeconds)
            }
            
            previousSpectrum = spectrum
        }
        
        return filterOnsets(onsets, minInterval: 0.05) // Minimum 50ms between onsets
    }
    
    /// Estimate tempo using autocorrelation
    public func estimateTempo(_ audioData: [Float]) -> Double {
        let onsetFunction = computeOnsetFunction(audioData)
        return tempoFromOnsetFunction(onsetFunction)
    }
    
    /// Estimate beat positions
    public func estimateBeats(_ audioData: [Float], tempo: Double) -> [Double] {
        let beatPeriod = 60.0 / tempo
        let totalDuration = Double(audioData.count) / sampleRate
        
        var beats: [Double] = []
        var currentBeat = 0.0
        
        // Simple metronomic beat estimation
        while currentBeat < totalDuration {
            beats.append(currentBeat)
            currentBeat += beatPeriod
        }
        
        return beats
    }
    
    /// Compute RMS envelope for dynamics
    public func computeRMSEnvelope(_ audioData: [Float]) -> [(time: Double, rmsDB: Double)] {
        let windowSize = Int(sampleRate * 0.1) // 100ms windows
        let hopSize = windowSize / 4 // 75% overlap
        
        var envelope: [(time: Double, rmsDB: Double)] = []
        
        var windowIndex = 0
        while windowIndex + windowSize < audioData.count {
            let window = Array(audioData[windowIndex..<windowIndex + windowSize])
            
            // Compute RMS
            let sumSquares = window.reduce(0) { $0 + $1 * $1 }
            let rms = sqrt(sumSquares / Float(windowSize))
            let rmsDB = 20.0 * log10(max(rms, 1e-10)) // Avoid log(0)
            
            let timeSeconds = Double(windowIndex) / sampleRate
            envelope.append((time: timeSeconds, rmsDB: Double(rmsDB)))
            
            windowIndex += hopSize
        }
        
        return envelope
    }
    
    // MARK: - Private Methods
    
    private func computeFrameSpectrum(_ frame: [Float]) -> [Float] {
        guard frame.count == frameSize,
              let setup = fftSetup else { return [] }
        
        // Apply window
        vDSP_vmul(frame, 1, window, 1, &windowedBuffer, 1, UInt(frameSize))
        
        // Convert to complex format
        windowedBuffer.withUnsafeBufferPointer { bufferPointer in
            bufferPointer.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: frameSize / 2) { complexPointer in
                vDSP_ctoz(complexPointer, 2, &complexBuffer, 1, UInt(frameSize / 2))
            }
        }
        
        // Perform FFT
        vDSP_DFT_Execute(setup, complexBuffer.realp, complexBuffer.imagp, complexBuffer.realp, complexBuffer.imagp)
        
        // Compute magnitude spectrum
        var magnitudes = Array(repeating: Float(0), count: frameSize / 2)
        vDSP_zvmags(&complexBuffer, 1, &magnitudes, 1, UInt(frameSize / 2))
        
        // Convert to dB and normalize
        vDSP_vdbcon(magnitudes, 1, &magnitudes, 1, UInt(frameSize / 2), 0)
        
        return magnitudes
    }
    
    private func spectrumToChroma(_ spectrum: [Float]) -> [Float] {
        var chroma = Array(repeating: Float(0), count: chromaBins)
        
        // Map frequency bins to chroma bins
        for (bin, magnitude) in spectrum.enumerated() {
            let frequency = Double(bin) * sampleRate / Double(frameSize)
            
            if frequency > 80 && frequency < 8000 { // Focus on musical range
                let pitch = 12.0 * log2(frequency / 440.0) + 69.0 // MIDI note number
                let chromaBin = Int(pitch) % 12
                
                if chromaBin >= 0 && chromaBin < chromaBins {
                    chroma[chromaBin] += magnitude
                }
            }
        }
        
        // Normalize chroma
        let sum = chroma.reduce(0, +)
        if sum > 0 {
            for i in 0..<chromaBins {
                chroma[i] /= sum
            }
        }
        
        return chroma
    }
    
    private func filterOnsets(_ onsets: [Double], minInterval: Double) -> [Double] {
        guard !onsets.isEmpty else { return [] }
        
        var filtered: [Double] = [onsets[0]]
        
        for onset in onsets.dropFirst() {
            if onset - filtered.last! >= minInterval {
                filtered.append(onset)
            }
        }
        
        return filtered
    }
    
    private func computeOnsetFunction(_ audioData: [Float]) -> [Float] {
        let spectrum = computeSpectrum(audioData)
        var onsetFunction: [Float] = []
        
        guard spectrum.count > 1 else { return [] }
        
        var previousSpectrum = spectrum[0]
        
        for currentSpectrum in spectrum.dropFirst() {
            var flux: Float = 0.0
            
            for (bin, magnitude) in currentSpectrum.enumerated() {
                let diff = magnitude - previousSpectrum[bin]
                if diff > 0 {
                    flux += diff
                }
            }
            
            onsetFunction.append(flux)
            previousSpectrum = currentSpectrum
        }
        
        return onsetFunction
    }
    
    private func tempoFromOnsetFunction(_ onsetFunction: [Float]) -> Double {
        guard !onsetFunction.isEmpty else { return 120.0 }
        
        // Simple autocorrelation-based tempo estimation
        let minTempo = 60.0 // BPM
        let maxTempo = 200.0 // BPM
        
        let minPeriod = Int((60.0 / maxTempo) * sampleRate / Double(hopSize))
        let maxPeriod = Int((60.0 / minTempo) * sampleRate / Double(hopSize))
        
        var bestScore: Float = 0
        var bestPeriod = minPeriod
        
        for period in minPeriod...min(maxPeriod, onsetFunction.count / 2) {
            var score: Float = 0
            var count = 0
            
            for i in period..<onsetFunction.count {
                score += onsetFunction[i] * onsetFunction[i - period]
                count += 1
            }
            
            if count > 0 {
                score /= Float(count)
                if score > bestScore {
                    bestScore = score
                    bestPeriod = period
                }
            }
        }
        
        let tempo = 60.0 * sampleRate / Double(hopSize) / Double(bestPeriod)
        return max(minTempo, min(maxTempo, tempo))
    }
}

// MARK: - Data Structures

public struct AudioFeatures {
    let spectrum: [[Float]]
    let chroma: [[Float]]
    let onsets: [Double]
    let tempo: Double
    let beats: [Double]
    let rmsEnvelope: [(time: Double, rmsDB: Double)]
    
    static func empty() -> AudioFeatures {
        return AudioFeatures(
            spectrum: [],
            chroma: [],
            onsets: [],
            tempo: 120.0,
            beats: [],
            rmsEnvelope: []
        )
    }
}