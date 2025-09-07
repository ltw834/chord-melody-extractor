import AVFoundation
import AudioKit
import SoundpipeAudioKit
import Combine

/// Main audio engine for DrumAI Studio
/// Manages AVAudioEngine with PlayerNode, analysis taps, and playhead synchronization
@MainActor
public final class AudioEngine: ObservableObject {
    
    // MARK: - Public Properties
    @Published public var isPlaying = false
    @Published public var currentTime: TimeInterval = 0
    @Published public var duration: TimeInterval = 0
    @Published public var isLooping = false
    @Published public var loopRange: ClosedRange<Int> = 0...4
    
    // MARK: - Private Properties
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var audioFile: AVAudioFile?
    private var audioBuffer: AVAudioPCMBuffer?
    
    private var displayLink: CADisplayLink?
    private var analysisCallback: ((AVAudioPCMBuffer) -> Void)?
    
    // Time tracking
    private var startTime: TimeInterval = 0
    private var pauseTime: TimeInterval = 0
    private var lastRenderTime: AVAudioTime?
    
    public init() {
        setupAudioEngine()
        startDisplayLink()
    }
    
    deinit {
        stop()
        displayLink?.invalidate()
        engine.stop()
    }
    
    // MARK: - Public Methods
    
    /// Load audio file and prepare for playback
    public func loadFile(_ url: URL) throws {
        stop()
        
        let file = try AVAudioFile(forReading: url)
        let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))!
        try file.read(into: buffer)
        
        self.audioFile = file
        self.audioBuffer = buffer
        self.duration = Double(file.length) / file.processingFormat.sampleRate
        
        // Reset playhead
        currentTime = 0
        
        print("Loaded audio file: \(url.lastPathComponent), duration: \(duration)s")
    }
    
    /// Start playback
    public func play() {
        guard let buffer = audioBuffer else { return }
        
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                print("Failed to start engine: \(error)")
                return
            }
        }
        
        if !isPlaying {
            // Schedule buffer from current position
            let startFrame = AVAudioFramePosition(currentTime * buffer.format.sampleRate)
            let framesToPlay = buffer.frameLength - AVAudioFrameCount(startFrame)
            
            if framesToPlay > 0 {
                let playBuffer = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: framesToPlay)!
                playBuffer.frameLength = framesToPlay
                
                // Copy audio data from current position
                let channelCount = Int(buffer.format.channelCount)
                for channel in 0..<channelCount {
                    let sourcePtr = buffer.floatChannelData![channel].advanced(by: Int(startFrame))
                    let destPtr = playBuffer.floatChannelData![channel]
                    destPtr.assign(from: sourcePtr, count: Int(framesToPlay))
                }
                
                player.scheduleBuffer(playBuffer) { [weak self] in
                    Task { @MainActor in
                        self?.handlePlaybackCompletion()
                    }
                }
                player.play()
                
                startTime = CACurrentMediaTime() - currentTime
                isPlaying = true
                
                // Haptic feedback
                let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
                impactFeedback.impactOccurred()
            }
        }
    }
    
    /// Pause playback
    public func pause() {
        if isPlaying {
            player.pause()
            pauseTime = currentTime
            isPlaying = false
            
            let impactFeedback = UIImpactFeedbackGenerator(style: .light)
            impactFeedback.impactOccurred()
        }
    }
    
    /// Stop playback and reset position
    public func stop() {
        player.stop()
        currentTime = 0
        startTime = 0
        pauseTime = 0
        isPlaying = false
        
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.impactOccurred()
    }
    
    /// Seek to specific time
    public func seek(to time: TimeInterval) {
        let wasPlaying = isPlaying
        
        if isPlaying {
            player.stop()
        }
        
        currentTime = max(0, min(time, duration))
        
        if wasPlaying {
            play()
        }
    }
    
    /// Set loop range in bars
    public func setLoopRange(_ range: ClosedRange<Int>) {
        loopRange = range
    }
    
    /// Toggle looping
    public func toggleLoop() {
        isLooping.toggle()
    }
    
    /// Set analysis callback for real-time processing
    public func setAnalysisCallback(_ callback: @escaping (AVAudioPCMBuffer) -> Void) {
        analysisCallback = callback
    }
    
    // MARK: - Private Methods
    
    private func setupAudioEngine() {
        // Attach player node
        engine.attach(player)
        
        // Connect player to main mixer
        engine.connect(player, to: engine.mainMixerNode, format: nil)
        
        // Install tap on main mixer for analysis
        let format = engine.mainMixerNode.outputFormat(forBus: 0)
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            self?.analysisCallback?(buffer)
        }
        
        // Prepare engine
        engine.prepare()
    }
    
    private func startDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(updatePlayhead))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func updatePlayhead() {
        guard isPlaying else { return }
        
        let now = CACurrentMediaTime()
        currentTime = now - startTime
        
        // Handle looping
        if isLooping && currentTime >= duration {
            currentTime = 0
            startTime = now
            
            // Restart playback
            if let buffer = audioBuffer {
                player.stop()
                player.scheduleBuffer(buffer) { [weak self] in
                    Task { @MainActor in
                        self?.handlePlaybackCompletion()
                    }
                }
                player.play()
            }
        } else if currentTime >= duration {
            // Natural end of track
            handlePlaybackCompletion()
        }
    }
    
    private func handlePlaybackCompletion() {
        guard isPlaying else { return }
        
        if isLooping {
            // Loop back to beginning
            currentTime = 0
            startTime = CACurrentMediaTime()
            
            if let buffer = audioBuffer {
                player.scheduleBuffer(buffer) { [weak self] in
                    Task { @MainActor in
                        self?.handlePlaybackCompletion()
                    }
                }
            }
        } else {
            // Stop at end
            isPlaying = false
            currentTime = duration
        }
    }
}

// MARK: - Extensions

extension AudioEngine {
    /// Convert time to bar/beat position
    public func timeToBarBeat(_ time: TimeInterval, tempo: Double, timeSig: (Int, Int)) -> (bar: Int, beat: Double) {
        let beatsPerBar = Double(timeSig.0)
        let beatDuration = 60.0 / tempo
        let totalBeats = time / beatDuration
        
        let bar = Int(totalBeats / beatsPerBar)
        let beat = totalBeats.truncatingRemainder(dividingBy: beatsPerBar)
        
        return (bar: bar, beat: beat)
    }
    
    /// Convert bar/beat to time
    public func barBeatToTime(bar: Int, beat: Double, tempo: Double, timeSig: (Int, Int)) -> TimeInterval {
        let beatsPerBar = Double(timeSig.0)
        let beatDuration = 60.0 / tempo
        let totalBeats = Double(bar) * beatsPerBar + beat
        
        return totalBeats * beatDuration
    }
}