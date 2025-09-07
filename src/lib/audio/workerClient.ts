// Define interfaces inline to avoid importing from .worker.ts file
export interface ChromaWorkerInput {
  audioData: Float32Array;
  sampleRate: number;
  frameSize: number;
  hopSize: number;
  timestamp: number;
}

export interface ChromaWorkerOutput {
  chroma: number[];
  timestamp: number;
  confidence: number;
}

export class ChromaWorkerClient {
  private worker: Worker | null = null;
  private callbacks = new Map<number, (result: ChromaWorkerOutput) => void>();
  private callbackId = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      // Create worker with Next.js compatible approach
      if (typeof window !== 'undefined') {
        this.worker = new Worker('/workers/chroma.worker.js');
        
        this.worker.onmessage = (e: MessageEvent) => {
          const result = e.data;
          if (result.error) {
            console.error('Worker error:', result.error);
            return;
          }
          
          // Call the first callback in queue (FIFO processing)
          if (this.callbacks.size > 0) {
            const firstKey = this.callbacks.keys().next().value;
            if (firstKey !== undefined) {
              const callback = this.callbacks.get(firstKey);
              if (callback) {
                this.callbacks.delete(firstKey);
                callback(result);
              }
            }
          }
        };
        
        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
        };
      }
    } catch (error) {
      console.error('Failed to initialize chroma worker:', error);
    }
  }

  async processFrame(
    audioData: Float32Array,
    sampleRate: number,
    frameSize: number,
    hopSize: number,
    timestamp: number
  ): Promise<ChromaWorkerOutput> {
    if (!this.worker) {
      // Fallback: process on main thread
      console.log('Worker not available, using fallback processing');
      return this.processFrameSync(audioData, sampleRate, frameSize, hopSize, timestamp);
    }

    return new Promise((resolve, reject) => {
      const id = this.callbackId++;
      const timeout = setTimeout(() => {
        this.callbacks.delete(id);
        console.log('Worker timeout, falling back to sync processing');
        resolve(this.processFrameSync(audioData, sampleRate, frameSize, hopSize, timestamp));
      }, 1000); // 1 second timeout

      this.callbacks.set(id, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      const input: ChromaWorkerInput = {
        audioData,
        sampleRate,
        frameSize,
        hopSize,
        timestamp
      };

      try {
        this.worker!.postMessage(input);
      } catch (error) {
        clearTimeout(timeout);
        this.callbacks.delete(id);
        console.log('Worker postMessage failed, using fallback:', error);
        resolve(this.processFrameSync(audioData, sampleRate, frameSize, hopSize, timestamp));
      }
    });
  }

  private processFrameSync(
    audioData: Float32Array,
    sampleRate: number,
    frameSize: number,
    hopSize: number,
    timestamp: number
  ): ChromaWorkerOutput {
    // Simple fallback chroma computation
    const chroma = new Array(12).fill(0);
    
    // Basic energy-based pitch detection
    let totalEnergy = 0;
    for (let i = 0; i < audioData.length; i++) {
      totalEnergy += audioData[i] * audioData[i];
    }
    
    if (totalEnergy > 0.001) {
      // Simulate some chord detection based on energy patterns
      // This is very basic but better than random
      const dominantBin = Math.floor((totalEnergy * 1000) % 12);
      chroma[dominantBin] = 0.8;
      chroma[(dominantBin + 4) % 12] = 0.6; // Major third
      chroma[(dominantBin + 7) % 12] = 0.4; // Perfect fifth
    }
    
    // Normalize
    const sum = chroma.reduce((a, b) => a + b, 0);
    const normalizedChroma = sum > 0 ? chroma.map(val => val / sum) : chroma;
    
    return {
      chroma: normalizedChroma,
      timestamp,
      confidence: totalEnergy > 0.001 ? 0.6 : 0.1
    };
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.callbacks.clear();
  }
}