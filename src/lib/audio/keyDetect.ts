import { chromaToKey } from '../utils/pitch';

export interface KeyEstimate {
  key: string;
  confidence: number;
  mode: 'major' | 'minor';
}

export class KeyDetector {
  private chromaHistory: number[][] = [];
  private readonly historySize = 20;

  addChromaFrame(chroma: number[]): void {
    this.chromaHistory.push([...chroma]);
    
    if (this.chromaHistory.length > this.historySize) {
      this.chromaHistory.shift();
    }
  }

  getCurrentKey(): KeyEstimate {
    if (this.chromaHistory.length === 0) {
      return { key: 'C', confidence: 0, mode: 'major' };
    }

    // Average chroma vectors over time for stability
    const avgChroma = this.computeAverageChroma();
    
    // Detect key using Krumhansl-Schmuckler algorithm
    const keyResult = chromaToKey(avgChroma);
    
    const isMinor = keyResult.key.endsWith('m');
    const keyName = isMinor ? keyResult.key.slice(0, -1) : keyResult.key;
    
    return {
      key: keyName,
      confidence: keyResult.confidence,
      mode: isMinor ? 'minor' : 'major'
    };
  }

  private computeAverageChroma(): number[] {
    if (this.chromaHistory.length === 0) {
      return new Array(12).fill(0);
    }

    const avgChroma = new Array(12).fill(0);
    
    // Weight recent frames more heavily
    this.chromaHistory.forEach((chroma, index) => {
      const weight = Math.pow(0.9, this.chromaHistory.length - 1 - index);
      
      for (let i = 0; i < 12; i++) {
        avgChroma[i] += chroma[i] * weight;
      }
    });

    // Normalize
    const sum = avgChroma.reduce((a, b) => a + b, 0);
    return sum > 0 ? avgChroma.map(val => val / sum) : avgChroma;
  }

  reset(): void {
    this.chromaHistory = [];
  }
}