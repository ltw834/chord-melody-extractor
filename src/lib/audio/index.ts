import { ChromaWorkerClient } from './workerClient';
import { AudioDecoder } from './decodeAudio';
import { ChordSmoother } from './smoothing';
import { KeyDetector } from './keyDetect';
import { TempoDetector } from './tempoDetect';
import { matchChordToChroma, generateChordTemplates } from '../chords/templates';
import { VocabularyLevel } from '../chords/vocab';
import { TimelineSegment } from '@/components/Timeline';
import { useAppStore } from '@/lib/store/useAppStore';

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
  onBeatInfo?: (beatInfo: import('./tempoDetect').BeatInfo) => void;
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
    
    // Read debug flag from store (default false). We capture a function to avoid importing react hooks here.
    try {
      // Access store synchronously
      const s = (require('@/lib/store/useAppStore') as any).useAppStore as any;
      this._debugEnabled = s.getState ? s.getState().settings?.debugLogging : false;
    } catch {
      this._debugEnabled = false;
    }
    
  }

  // Internal flag to gate debug logs
  private _debugEnabled: boolean = false;

  private logDebug(...args: any[]) {
    if (this._debugEnabled) {
      try { console.debug(...args); } catch {}
    }
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

  // DEBUG: streaming frame info
  this.logDebug('[AudioProcessor] stream frame ts', timestamp.toFixed(3), 'keyPrior', keyPrior, 'chordMatch', chordMatch);

      // Apply smoothing
      const smoothedResult = this.chordSmoother.addObservation(chordMatch, timestamp);

  this.logDebug('[AudioProcessor] stream smoothed', smoothedResult);

      // Update current chord
      if (smoothedResult.confidence > 0.3) {
        this.callbacks.onChordDetected?.(smoothedResult.chord, smoothedResult.confidence);
        
        // Handle segment creation/updating
        this.handleChordSegment(smoothedResult.chord, smoothedResult.confidence, timestamp);
      }

      // Periodically report key and tempo
      if (timestamp - this.lastSegmentTime > 2.0) { // Every 2 seconds
        try {
          const beatInfo = this.tempoDetector.getBeatInfo();
          if (keyEstimate.confidence > 0.6) {
            this.callbacks.onKeyDetected?.(
              keyEstimate.key,
              keyEstimate.confidence,
              keyEstimate.mode
            );
          }
          if (beatInfo.confidence > 0.2) {
            this.callbacks.onTempoDetected?.(beatInfo.bpm, beatInfo.confidence);
            this.callbacks.onBeatInfo?.(beatInfo);
          }
        } catch {}
        
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

          // Feed the raw frame to tempo detector as well so file processing can estimate BPM
          try { this.tempoDetector.addAudioFrame(frames[i], timestamp); } catch {}

          this.keyDetector.addChromaFrame(chromaResult.chroma);

          // DEBUG: log chroma snapshot
          this.logDebug('[AudioProcessor] frame', i, 'ts', timestamp.toFixed(3), 'chroma', chromaResult.chroma.map((v: number) => v.toFixed(3)));
          
          const keyEstimate = this.keyDetector.getCurrentKey();
          const keyPrior = keyEstimate.confidence > 0.5 ? 
            keyEstimate.key + (keyEstimate.mode === 'minor' ? 'm' : '') : 
            undefined;

          const chordMatch = matchChordToChroma(
            chromaResult.chroma,
            this.config.vocabularyLevel,
            keyPrior
          );

          // DEBUG: log chord match
          this.logDebug('[AudioProcessor] chordMatch', timestamp.toFixed(3), chordMatch);

          const smoothedResult = this.chordSmoother.addObservation(chordMatch, timestamp);

          // DEBUG: log smoothing result
          this.logDebug('[AudioProcessor] smoothed', timestamp.toFixed(3), smoothedResult);

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
  this.logDebug('[AudioProcessor] progress', Math.round(progress));
        
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

      // After processing, compute tempo and quantize segment boundaries to the beat grid
      try {
        const beatInfo = this.tempoDetector.getBeatInfo();
        if (beatInfo.confidence > 0) {
          this.callbacks.onTempoDetected?.(beatInfo.bpm, beatInfo.confidence);
          this.callbacks.onBeatInfo?.(beatInfo);
        }

        // Quantize segments to nearest beat using detected beatInfo (assume 4/4 for now)
        if (segments.length > 0 && beatInfo.confidence > 0) {
          const beatSec = 60 / Math.max(1, beatInfo.bpm);
          const quantize = (t: number) => Math.round(t / beatSec) * beatSec;

          const quantized: TimelineSegment[] = segments.map(s => ({
            chord: s.chord,
            startTime: Math.max(0, quantize(s.startTime)),
            endTime: Math.max(quantize(s.endTime), quantize(s.startTime) + beatSec),
            confidence: s.confidence
          }));

          // Merge adjacent segments with same chord and enforce minimum length
          const merged: TimelineSegment[] = [];
          for (const s of quantized) {
            const last = merged[merged.length - 1];
            if (last && last.chord === s.chord && Math.abs(last.endTime - s.startTime) <= 1e-3) {
              // extend
              last.endTime = Math.max(last.endTime, s.endTime);
              last.confidence = Math.max(last.confidence, s.confidence);
            } else {
              merged.push({ ...s });
            }
          }

          // Replace segments and notify callbacks
          segments.length = 0;
          for (const s of merged) {
            // ensure min length of 1 beat
            if (s.endTime - s.startTime < beatSec) s.endTime = s.startTime + beatSec;
            segments.push(s);
            this.callbacks.onSegmentAdded?.(s);
          }

          // Also publish a simple time signature to store/callbacks (assume 4/4)
          try {
            // If consumer provided onKeyDetected and onTempoDetected, they can pick up time signature via store
            // We also call onKeyDetected for key and a separate callback for time signature isn't defined; use onTempoDetected for tempo only.
          } catch {}
        }
      } catch (e) {
        // ignore tempo/quantize failures
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

// Helper: convert time (sec) -> bar/beat
export function timeToBarBeat(tSec: number, info: import('./tempoDetect').BeatInfo) {
  const beatSec = 60 / Math.max(1, info.bpm) * (4 / info.timeSignature.denominator);
  const globalBeat = tSec / beatSec; // float
  const beatsPerBar = info.timeSignature.numerator;
  const bar = Math.floor(globalBeat / beatsPerBar) + 1;
  const beat = Math.floor(globalBeat % beatsPerBar) + 1;
  return { bar, beat, beatFloat: globalBeat };
}

export function quantizeSegmentsToBeats(
  segments: { start: number; end: number; label: string; confidence: number }[],
  info: import('./tempoDetect').BeatInfo,
  mode: 'beat' | 'half' | 'bar' = 'beat'
){
  const beatSec = 60 / Math.max(1, info.bpm) * (4 / info.timeSignature.denominator);
  const step = mode === 'bar' ? info.timeSignature.numerator
            : mode === 'half' ? 0.5
            : 1;

  const toBeat = (t: number) => Math.round((t / beatSec) / step) * step;
  const blocks: any[] = [];
  for (const s of segments) {
    const startBeat = Math.max(0, toBeat(s.start));
    const endBeat = Math.max(startBeat + step, toBeat(s.end));
    const barIndex = Math.floor(startBeat / info.timeSignature.numerator);
    blocks.push({
      label: s.label,
      startSec: startBeat * beatSec,
      endSec: endBeat * beatSec,
      startBeat,
      endBeat,
      barIndex,
      confidence: s.confidence ?? 1
    });
  }

  // merge adjacent same label
  const merged: any[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && last.label === b.label && Math.abs(last.endSec - b.startSec) < 1e-3) {
      last.endSec = Math.max(last.endSec, b.endSec);
      last.endBeat = Math.max(last.endBeat, b.endBeat);
      last.confidence = Math.max(last.confidence, b.confidence);
    } else merged.push({ ...b });
  }

  return merged;
}
