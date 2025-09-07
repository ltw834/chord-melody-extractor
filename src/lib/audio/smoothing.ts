import { median } from '../utils/math';
import { ChordMatch } from '../chords/templates';

export interface SmoothedChordResult {
  chord: string;
  confidence: number;
  timestamp: number;
}

export class ChordSmoother {
  private buffer: ChordMatch[] = [];
  private readonly bufferSize: number;
  private readonly confidenceThreshold: number;

  constructor(bufferSize = 5, confidenceThreshold = 0.3) {
    this.bufferSize = bufferSize;
    this.confidenceThreshold = confidenceThreshold;
  }

  addObservation(observation: ChordMatch, timestamp: number): SmoothedChordResult {
    this.buffer.push(observation);
    
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Apply median filter to chord names
    const smoothedChord = this.getSmoothedChord();
    const smoothedConfidence = this.getSmoothedConfidence();

    return {
      chord: smoothedChord,
      confidence: smoothedConfidence,
      timestamp
    };
  }

  private getSmoothedChord(): string {
    if (this.buffer.length === 0) return 'N/C';
    
    // Count occurrences of each chord
    const chordCounts = new Map<string, number>();
    const confidenceWeights = new Map<string, number>();
    
    this.buffer.forEach(match => {
      const count = chordCounts.get(match.name) || 0;
      const weight = confidenceWeights.get(match.name) || 0;
      
      chordCounts.set(match.name, count + 1);
      confidenceWeights.set(match.name, weight + match.confidence);
    });
    
    // Find chord with highest weighted score
    let bestChord = 'N/C';
    let bestScore = 0;
    
    for (const [chord, count] of chordCounts.entries()) {
      const avgConfidence = (confidenceWeights.get(chord) || 0) / count;
      const score = count * avgConfidence;
      
      if (score > bestScore && avgConfidence > this.confidenceThreshold) {
        bestScore = score;
        bestChord = chord;
      }
    }
    
    return bestChord;
  }

  private getSmoothedConfidence(): number {
    if (this.buffer.length === 0) return 0;
    
    const confidences = this.buffer.map(match => match.confidence);
    
    // Use median filter for confidence smoothing
    const medianConfidence = median(confidences);
    
    // Apply slight boost for temporal consistency
    const consistencyBonus = this.getConsistencyBonus();
    
    return Math.min(1, medianConfidence * consistencyBonus);
  }

  private getConsistencyBonus(): number {
    if (this.buffer.length < 3) return 1.0;
    
    // Check how consistent recent observations are
    const recentChords = this.buffer.slice(-3).map(match => match.name);
    const uniqueChords = new Set(recentChords).size;
    
    // Bonus for stability
    if (uniqueChords === 1) return 1.2;
    if (uniqueChords === 2) return 1.1;
    
    return 1.0;
  }

  clear(): void {
    this.buffer = [];
  }
}