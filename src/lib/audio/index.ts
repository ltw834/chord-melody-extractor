import { ChromaWorkerClient } from './workerClient';
import { AudioDecoder } from './decodeAudio';
import { ChordSmoother } from './smoothing';
import { KeyDetector } from './keyDetect';
import { TempoDetector } from './tempoDetect';
import { matchChordToChroma, generateChordTemplates } from '../chords/templates';
import { VocabularyLevel } from '../chords/vocab';
import { TimelineSegment } from '@/components/Timeline';

export interface AudioProcessorConfig {
  sampleRate?: number;
  frameSize?: number;
  hopSize?: number;
  vocabularyLevel?: VocabularyLevel;
  smoothingStrength?: number;
  updateRate?: number;
}

export interface AudioProcessorCallbacks {
  onChordDetected?: (chord: string, confidence: number) => void;
  onSegmentAdded?: (segment: TimelineSegment) => void;
  onKeyDetected?: (key: string, confidence: number, mode: 'major' | 'minor') => void;
  onTempoDetected?: (bpm: number, confidence: number) => void;
  onError?: (error: string) => void;
  onProcessingProgress?: (progress: number) => void;
}

export class AudioProcessor {
  private config: Required<AudioProcessorConfig>;
  private callbacks: AudioProcessorCallbacks;
  
  private chromaWorker: ChromaWorkerClient;
  private audioDecoder: AudioDecoder;
  private chordSmoother: ChordSmoother;
  private keyDetector: KeyDetector;
  private tempoDetector: TempoDetector;
  
  private isProcessing = false;
  private isStreaming = false;
  private lastChord = '';
  private lastSegmentTime = 0;
  private currentSegment: TimelineSegment | null = null;
  private animationFrame?: number;
  private elementContext?: AudioContext;
  private elementProcessor?: ScriptProcessorNode;
  private elementSource?: MediaElementAudioSourceNode;

  constructor(config: AudioProcessorConfig = {}, callbacks: AudioProcessorCallbacks = {}) {
    this.config = {
      sampleRate: config.sampleRate || 44100,
      frameSize: config.frameSize || 4096,
      hopSize: config.hopSize || 1024,
      vocabularyLevel: config.vocabularyLevel || 'basic',
      smoothingStrength: config.smoothingStrength || 0.5,
      updateRate: config.updateRate || 20
    };
    
    this.callbacks = callbacks;
    
    // Initialize components
    this.chromaWorker = new ChromaWorkerClient();
    this.audioDecoder = new AudioDecoder();
    this.chordSmoother = new ChordSmoother(
      Math.ceil(this.config.smoothingStrength * 10),
      0.3
    );
    this.keyDetector = new KeyDetector();
    this.tempoDetector = new TempoDetector();
    
  }


  // Expose frame processing for streaming sources (microphone)
  async processAudioFrame(audioData: Float32Array, timestamp: number): Promise<void> {
    try {
      // Process audio through chroma extraction
      const chromaResult = await this.chromaWorker.processFrame(
        audioData,
        this.config.sampleRate,
        this.config.frameSize,
        this.config.hopSize,
        timestamp
      );

      // Update key and tempo detectors
      this.keyDetector.addChromaFrame(chromaResult.chroma);
      this.tempoDetector.addAudioFrame(audioData, timestamp);

      // Match chroma to chord
      const keyEstimate = this.keyDetector.getCurrentKey();
      const keyPrior = keyEstimate.confidence > 0.5 ? 
        keyEstimate.key + (keyEstimate.mode === 'minor' ? 'm' : '') : 
        undefined;

      const chordMatch = matchChordToChroma(
        chromaResult.chroma,
        this.config.vocabularyLevel,
        keyPrior
      );

      // Apply smoothing
      const smoothedResult = this.chordSmoother.addObservation(chordMatch, timestamp);

      // Update current chord
      if (smoothedResult.confidence > 0.3) {
        this.callbacks.onChordDetected?.(smoothedResult.chord, smoothedResult.confidence);
        
        // Handle segment creation/updating
        this.handleChordSegment(smoothedResult.chord, smoothedResult.confidence, timestamp);
      }

      // Periodically report key and tempo
      if (timestamp - this.lastSegmentTime > 2.0) { // Every 2 seconds
        const tempoEstimate = this.tempoDetector.getCurrentTempo();
        
        if (keyEstimate.confidence > 0.6) {
          this.callbacks.onKeyDetected?.(
            keyEstimate.key,
            keyEstimate.confidence,
            keyEstimate.mode
          );
        }
        
        if (tempoEstimate.confidence > 0.5) {
          this.callbacks.onTempoDetected?.(
            tempoEstimate.bpm,
            tempoEstimate.confidence
          );
        }
        
        this.lastSegmentTime = timestamp;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio processing error';
      this.callbacks.onError?.(errorMessage);
    }
  }

  private handleChordSegment(chord: string, confidence: number, timestamp: number): void {
    if (chord === this.lastChord) {
      // Extend current segment
      if (this.currentSegment) {
        this.currentSegment.endTime = timestamp;
        this.currentSegment.confidence = Math.max(this.currentSegment.confidence, confidence);
      }
    } else {
      // Finalize previous segment
      if (this.currentSegment && this.currentSegment.endTime - this.currentSegment.startTime > 0.5) {
        this.callbacks.onSegmentAdded?.(this.currentSegment);
      }
      
      // Start new segment
      this.currentSegment = {
        chord,
        startTime: timestamp,
        endTime: timestamp + 0.1,
        confidence
      };
      
      this.lastChord = chord;
    }
  }

  private processFrameDirectly(audioData: Float32Array, timestamp: number) {
    // Simple energy-based chroma computation for main thread
    const chroma = new Array(12).fill(0);
    
    // Basic energy analysis
    let totalEnergy = 0;
    let maxAmplitude = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.abs(audioData[i]);
      totalEnergy += sample * sample;
      maxAmplitude = Math.max(maxAmplitude, sample);
    }
    
    if (totalEnergy > 0.001 && maxAmplitude > 0.01) {
      // Basic frequency estimation based on zero crossings and energy
      let zeroCrossings = 0;
      for (let i = 1; i < audioData.length; i++) {
        if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
      
      // Estimate fundamental frequency from zero crossings
      const fundamentalFreq = (zeroCrossings * this.config.sampleRate) / (2 * audioData.length);
      
      if (fundamentalFreq > 80 && fundamentalFreq < 2000) {
        // Convert to MIDI note and then to chroma
        const midiNote = 12 * Math.log2(fundamentalFreq / 440) + 69;
        const pitchClass = Math.round(midiNote) % 12;
        
        if (pitchClass >= 0 && pitchClass < 12) {
          chroma[pitchClass] = 0.8;
          // Add some harmonics for more realistic chord detection
          chroma[(pitchClass + 4) % 12] += 0.4; // Major third
          chroma[(pitchClass + 7) % 12] += 0.3; // Perfect fifth
        }
      }
    }
    
    // Normalize chroma
    const sum = chroma.reduce((a, b) => a + b, 0);
    const normalizedChroma = sum > 0 ? chroma.map(val => val / sum) : chroma;
    
    return {
      chroma: normalizedChroma,
      timestamp,
      confidence: totalEnergy > 0.001 ? Math.min(0.8, totalEnergy * 10) : 0.1
    };
  }

  // Public API methods
  startStream(): void {
    this.isStreaming = true;
    this.lastChord = '';
    this.lastSegmentTime = 0;
    this.currentSegment = null;
    // Reset smoothing state by recreating smoother
    this.chordSmoother = new ChordSmoother(
      Math.ceil(this.config.smoothingStrength * 10),
      0.3
    );
    this.keyDetector = new KeyDetector();
    this.tempoDetector = new TempoDetector();
  }

  stopStream(): void {
    this.isStreaming = false;
    // Flush last current segment if any
    if (this.currentSegment && this.currentSegment.endTime - this.currentSegment.startTime > 0.5) {
      this.callbacks.onSegmentAdded?.(this.currentSegment);
    }
    this.currentSegment = null;
  }

  // Attach a HTMLMediaElement and analyze its audio via WebAudio
  async attachElement(media: HTMLMediaElement): Promise<void> {
    // Clean any previous graph
    if (this.elementProcessor) {
      this.elementProcessor.disconnect();
      this.elementProcessor.onaudioprocess = null;
      this.elementProcessor = undefined;
    }
    if (this.elementSource) {
      this.elementSource.disconnect();
      this.elementSource = undefined;
    }
    if (!this.elementContext) {
      this.elementContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.elementContext.state === 'suspended') await this.elementContext.resume();

    // Build processing chain
    const ctx = this.elementContext;
    const source = ctx.createMediaElementSource(media);
    const processor = ctx.createScriptProcessor(this.config.hopSize, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0; // keep node alive without double audio
    source.connect(processor);
    source.connect(mute);
    mute.connect(ctx.destination);
    processor.connect(ctx.destination);

    processor.onaudioprocess = async (event) => {
      if (!this.isStreaming) return;
      const input = event.inputBuffer.getChannelData(0);
      const frame = new Float32Array(input);
      const timestamp = media.currentTime;
      await this.processAudioFrame(frame, timestamp);
    };

    this.startStream();
    this.elementProcessor = processor;
    this.elementSource = source;
  }

  async processFile(file: File): Promise<TimelineSegment[]> {
    try {
      this.callbacks.onProcessingProgress?.(0);

      const audioResult = await this.audioDecoder.decodeFile(file);
      const audioData = this.audioDecoder.audioBufferToMono(audioResult.audioBuffer);
      
      // Extract frames for processing
      const frames = this.audioDecoder.extractFrames(
        audioData,
        this.config.frameSize,
        this.config.hopSize
      );

      this.callbacks.onProcessingProgress?.(10);

      const segments: TimelineSegment[] = [];
      let currentChord = '';
      let currentStartTime = 0;
      let currentConfidence = 0;

      // Process frames in smaller batches to avoid blocking
      const batchSize = 10;
      const totalFrames = frames.length;

      for (let batchStart = 0; batchStart < totalFrames; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalFrames);
        
        // Process batch of frames using worker-backed chroma extraction
        for (let i = batchStart; i < batchEnd; i++) {
          const timestamp = (i * this.config.hopSize) / audioResult.sampleRate;

          // Prefer worker processing; falls back internally if unavailable
          const chromaResult = await this.chromaWorker.processFrame(
            frames[i],
            audioResult.sampleRate, // use true sample rate
            this.config.frameSize,
            this.config.hopSize,
            timestamp
          );

          this.keyDetector.addChromaFrame(chromaResult.chroma);
          
          const keyEstimate = this.keyDetector.getCurrentKey();
          const keyPrior = keyEstimate.confidence > 0.5 ? 
            keyEstimate.key + (keyEstimate.mode === 'minor' ? 'm' : '') : 
            undefined;

          const chordMatch = matchChordToChroma(
            chromaResult.chroma,
            this.config.vocabularyLevel,
            keyPrior
          );

          const smoothedResult = this.chordSmoother.addObservation(chordMatch, timestamp);

          if (smoothedResult.chord !== currentChord) {
            // Finalize previous segment
            if (currentChord && timestamp - currentStartTime > 0.5) {
              segments.push({
                chord: currentChord,
                startTime: currentStartTime,
                endTime: timestamp,
                confidence: currentConfidence
              });
            }
            
            // Start new segment
            currentChord = smoothedResult.chord;
            currentStartTime = timestamp;
            currentConfidence = smoothedResult.confidence;
          } else {
            currentConfidence = Math.max(currentConfidence, smoothedResult.confidence);
          }
        }

        // Update progress and yield to main thread
        const progress = 10 + (batchEnd / totalFrames) * 85;
        this.callbacks.onProcessingProgress?.(Math.round(progress));
        
        // Yield control to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Finalize last segment
      if (currentChord) {
        segments.push({
          chord: currentChord,
          startTime: currentStartTime,
          endTime: audioResult.duration,
          confidence: currentConfidence
        });
      }

      this.callbacks.onProcessingProgress?.(100);
      return segments;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'File processing error';
      this.callbacks.onError?.(errorMessage);
      return [];
    }
  }

  updateConfig(newConfig: Partial<AudioProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update smoothing if strength changed
    if (newConfig.smoothingStrength !== undefined) {
      this.chordSmoother = new ChordSmoother(
        Math.ceil(newConfig.smoothingStrength * 10),
        0.3
      );
    }
  }


  dispose(): void {
    this.audioDecoder.dispose();
    this.chromaWorker.terminate();
  }
}
