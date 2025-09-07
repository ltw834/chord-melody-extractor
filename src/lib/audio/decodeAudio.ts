export interface AudioDecodeResult {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  channels: number;
}

export class AudioDecoder {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async decodeFile(file: File): Promise<AudioDecodeResult> {
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      return {
        audioBuffer,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels
      };
    } catch (error) {
      throw new Error(`Failed to decode audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decodeBlob(blob: Blob): Promise<AudioDecodeResult> {
    const arrayBuffer = await blob.arrayBuffer();
    
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      return {
        audioBuffer,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels
      };
    } catch (error) {
      throw new Error(`Failed to decode audio blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Convert stereo to mono by averaging channels
  audioBufferToMono(audioBuffer: AudioBuffer): Float32Array {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);

    if (channels === 1) {
      monoData.set(audioBuffer.getChannelData(0));
    } else {
      // Average all channels
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / channels;
      }
    }

    return monoData;
  }

  // Extract audio frames for processing
  extractFrames(audioData: Float32Array, frameSize: number, hopSize: number): Float32Array[] {
    const frames: Float32Array[] = [];
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;

    for (let i = 0; i < numFrames; i++) {
      const startIndex = i * hopSize;
      const endIndex = Math.min(startIndex + frameSize, audioData.length);
      
      const frame = new Float32Array(frameSize);
      const actualLength = endIndex - startIndex;
      
      frame.set(audioData.slice(startIndex, endIndex));
      
      // Zero-pad if necessary
      if (actualLength < frameSize) {
        frame.fill(0, actualLength);
      }
      
      frames.push(frame);
    }

    return frames;
  }

  // Apply fade in/out to avoid clicks
  applyFade(audioData: Float32Array, fadeLength = 0.01): Float32Array {
    const fadeSamples = Math.floor(fadeLength * audioData.length);
    const result = new Float32Array(audioData.length);
    result.set(audioData);

    // Fade in
    for (let i = 0; i < fadeSamples && i < result.length; i++) {
      result[i] *= i / fadeSamples;
    }

    // Fade out
    const startFadeOut = result.length - fadeSamples;
    for (let i = startFadeOut; i < result.length; i++) {
      result[i] *= (result.length - i) / fadeSamples;
    }

    return result;
  }

  // Resample audio to target sample rate
  resample(audioData: Float32Array, originalRate: number, targetRate: number): Float32Array {
    if (originalRate === targetRate) {
      return audioData;
    }

    const ratio = originalRate / targetRate;
    const outputLength = Math.floor(audioData.length / ratio);
    const resampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < audioData.length) {
        // Linear interpolation
        resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampled[i] = audioData[index] || 0;
      }
    }

    return resampled;
  }

  dispose(): void {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}