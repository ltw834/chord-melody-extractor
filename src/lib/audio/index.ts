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
  private lastChord = '';
  private lastSegmentTime = 0;
  private currentSegment: TimelineSegment | null = null;
  private animationFrame?: number;

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


  private async processAudioFrame(audioData: Float32Array, timestamp: number): Promise<void> {
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

  // Public API methods

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
        
        // Process batch of frames
        for (let i = batchStart; i < batchEnd; i++) {
          const timestamp = (i * this.config.hopSize) / this.config.sampleRate;
          
          const chromaResult = await this.chromaWorker.processFrame(
            frames[i],
            this.config.sampleRate,
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