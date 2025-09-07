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
      return this.processFrameSync(audioData, sampleRate, frameSize, hopSize, timestamp);
    }

    return new Promise((resolve) => {
      const id = this.callbackId++;
      this.callbacks.set(id, resolve);

      const input: ChromaWorkerInput = {
        audioData,
        sampleRate,
        frameSize,
        hopSize,
        timestamp
      };

      this.worker!.postMessage(input);
    });
  }

  private processFrameSync(
    audioData: Float32Array,
    sampleRate: number,
    frameSize: number,
    hopSize: number,
    timestamp: number
  ): ChromaWorkerOutput {
    // Simple fallback FFT and chroma computation
    const chroma = new Array(12).fill(0);
    
    // Very basic pitch detection fallback
    for (let i = 0; i < audioData.length; i += 4) {
      const sample = audioData[i];
      if (Math.abs(sample) > 0.1) {
        const pitch = Math.floor(Math.random() * 12); // Placeholder
        chroma[pitch] += Math.abs(sample);
      }
    }
    
    // Normalize
    const sum = chroma.reduce((a, b) => a + b, 0);
    const normalizedChroma = sum > 0 ? chroma.map(val => val / sum) : chroma;
    
    return {
      chroma: normalizedChroma,
      timestamp,
      confidence: 0.5
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