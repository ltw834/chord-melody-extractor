import { ChordDefinition, getChordsByLevel, VocabularyLevel } from './vocab';
import { cosineSimilarity } from '../utils/math';

export interface ChordTemplate {
  name: string;
  template: number[];
  quality: string;
}

export interface ChordMatch {
  name: string;
  confidence: number;
  template: number[];
}

export function generateChordTemplates(level: VocabularyLevel = 'basic'): ChordTemplate[] {
  const chords = getChordsByLevel(level);
  
  return chords.map(chord => ({
    name: chord.name,
    template: intervalsToChromaTemplate(chord.intervals),
    quality: chord.quality
  }));
}

function intervalsToChromaTemplate(intervals: number[]): number[] {
  const template = new Array(12).fill(0);
  
  intervals.forEach((interval, index) => {
    const weight = index === 0 ? 1.0 : // Root gets full weight
                   index === 1 ? 0.8 : // Second note (3rd or 5th) gets high weight  
                   index === 2 ? 0.7 : // Third note gets medium-high weight
                   0.5; // Additional notes get medium weight
    
    template[interval % 12] = weight;
  });
  
  return template;
}

export function matchChordToChroma(
  chroma: number[], 
  level: VocabularyLevel = 'basic',
  keyPrior?: string
): ChordMatch {
  const templates = generateChordTemplates(level);
  let bestMatch: ChordMatch = {
    name: 'N/C', // No chord
    confidence: 0,
    template: new Array(12).fill(0)
  };
  
  for (const template of templates) {
    let similarity = cosineSimilarity(chroma, template.template);
    
    // Apply key prior if provided
    if (keyPrior && similarity > 0.3) {
      const keyBonus = calculateKeyPriorBonus(template.name, keyPrior);
      similarity *= keyBonus;
    }
    
    // Apply harmonic emphasis for better chord detection
    similarity *= calculateHarmonicEmphasis(chroma, template.template);
    
    if (similarity > bestMatch.confidence) {
      bestMatch = {
        name: template.name,
        confidence: Math.min(1, similarity),
        template: template.template
      };
    }
  }
  
  return bestMatch;
}

function calculateKeyPriorBonus(chordName: string, key: string): number {
  const isMinorKey = key.endsWith('m');
  const keyRoot = isMinorKey ? key.slice(0, -1) : key;
  
  // Simple key-chord relationship scoring
  const chordRoot = chordName.replace(/[^A-G#b]/g, '');
  
  if (chordRoot === keyRoot) {
    return 1.2; // Tonic chord gets boost
  }
  
  // Add more sophisticated key-chord relationships
  const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(keyRoot);
  const chordIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(chordRoot);
  
  if (keyIndex >= 0 && chordIndex >= 0) {
    const interval = (chordIndex - keyIndex + 12) % 12;
    
    if (isMinorKey) {
      // Minor key chord preferences
      if ([0, 3, 5, 7, 10].includes(interval)) {
        return 1.1; // i, III, v, VII, etc.
      }
    } else {
      // Major key chord preferences  
      if ([0, 2, 4, 5, 7, 9, 11].includes(interval)) {
        return 1.1; // I, ii, iii, IV, V, vi, vii
      }
    }
  }
  
  return 1.0; // No bonus
}

function calculateHarmonicEmphasis(chroma: number[], template: number[]): number {
  // Emphasize strong harmonic content
  let emphasis = 1.0;
  
  // Check for clear fundamental
  const maxChroma = Math.max(...chroma);
  const chromaSum = chroma.reduce((a, b) => a + b, 0);
  
  if (maxChroma > 0.3 && chromaSum > 0.5) {
    emphasis *= 1.1;
  }
  
  // Penalize very sparse or very dense chroma vectors
  const nonZeroCount = chroma.filter(val => val > 0.1).length;
  if (nonZeroCount < 2 || nonZeroCount > 8) {
    emphasis *= 0.9;
  }
  
  return emphasis;
}

// Viterbi decoding for chord progression smoothing
export class ChordViterbiDecoder {
  private transitionMatrix: number[][];
  private chordNames: string[];
  
  constructor(chordNames: string[]) {
    this.chordNames = chordNames;
    this.transitionMatrix = this.buildTransitionMatrix();
  }
  
  private buildTransitionMatrix(): number[][] {
    const n = this.chordNames.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0.1)); // Small transition probability
    
    // Self-transition (staying on same chord) is more likely
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 0.7;
    }
    
    // Common chord progressions get higher transition probabilities
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const transitionBonus = this.getTransitionBonus(this.chordNames[i], this.chordNames[j]);
        matrix[i][j] *= transitionBonus;
      }
    }
    
    // Normalize rows
    for (let i = 0; i < n; i++) {
      const rowSum = matrix[i].reduce((a, b) => a + b, 0);
      for (let j = 0; j < n; j++) {
        matrix[i][j] /= rowSum;
      }
    }
    
    return matrix;
  }
  
  private getTransitionBonus(from: string, to: string): number {
    // Simple music theory-based transition bonuses
    if (from === to) return 1.0;
    
    // Perfect fifth transitions are common
    const fromRoot = from.charAt(0);
    const toRoot = to.charAt(0);
    const semitones = this.getSemitoneDistance(fromRoot, toRoot);
    
    if (semitones === 7 || semitones === 5) { // Perfect fifth up or down
      return 2.0;
    }
    
    if (semitones === 2 || semitones === 4) { // Whole step or major third
      return 1.5;
    }
    
    return 1.0;
  }
  
  private getSemitoneDistance(from: string, to: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const fromIndex = notes.indexOf(from);
    const toIndex = notes.indexOf(to);
    
    if (fromIndex === -1 || toIndex === -1) return 6; // Default distance
    
    return Math.min(
      Math.abs(toIndex - fromIndex),
      12 - Math.abs(toIndex - fromIndex)
    );
  }
  
  decode(observations: ChordMatch[]): string[] {
    if (observations.length === 0) return [];
    if (observations.length === 1) return [observations[0].name];
    
    const n = observations.length;
    const numStates = this.chordNames.length;
    
    // Viterbi algorithm
    const viterbi = Array(n).fill(null).map(() => Array(numStates).fill(-Infinity));
    const path = Array(n).fill(null).map(() => Array(numStates).fill(0));
    
    // Initialize
    for (let s = 0; s < numStates; s++) {
      const chordName = this.chordNames[s];
      const emissionProb = observations[0].name === chordName ? 
        Math.log(observations[0].confidence + 0.01) : 
        Math.log(0.01);
      viterbi[0][s] = Math.log(1.0 / numStates) + emissionProb;
    }
    
    // Recursion
    for (let t = 1; t < n; t++) {
      for (let s = 0; s < numStates; s++) {
        let maxProb = -Infinity;
        let maxState = 0;
        
        for (let prevS = 0; prevS < numStates; prevS++) {
          const prob = viterbi[t-1][prevS] + Math.log(this.transitionMatrix[prevS][s]);
          if (prob > maxProb) {
            maxProb = prob;
            maxState = prevS;
          }
        }
        
        const chordName = this.chordNames[s];
        const emissionProb = observations[t].name === chordName ?
          Math.log(observations[t].confidence + 0.01) :
          Math.log(0.01);
          
        viterbi[t][s] = maxProb + emissionProb;
        path[t][s] = maxState;
      }
    }
    
    // Backtrack
    const result = new Array(n);
    let lastState = 0;
    let maxProb = -Infinity;
    
    for (let s = 0; s < numStates; s++) {
      if (viterbi[n-1][s] > maxProb) {
        maxProb = viterbi[n-1][s];
        lastState = s;
      }
    }
    
    result[n-1] = this.chordNames[lastState];
    
    for (let t = n-2; t >= 0; t--) {
      lastState = path[t+1][lastState];
      result[t] = this.chordNames[lastState];
    }
    
    return result;
  }
}