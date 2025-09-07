export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToChroma(frequencies: number[], sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const nyquist = sampleRate / 2;
  
  for (let bin = 0; bin < frequencies.length; bin++) {
    const freq = (bin * nyquist) / frequencies.length;
    if (freq < 80 || freq > 2000) continue; // Focus on musical range
    
    const midi = 12 * Math.log2(freq / 440) + 69;
    const pitchClass = Math.round(midi) % 12;
    
    if (pitchClass >= 0 && pitchClass < 12) {
      chroma[pitchClass] += frequencies[bin];
    }
  }
  
  // Normalize
  const sum = chroma.reduce((a, b) => a + b, 0);
  return sum > 0 ? chroma.map(val => val / sum) : chroma;
}

export function chromaToKey(chroma: number[]): { key: string; confidence: number } {
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  
  let bestKey = '';
  let bestConfidence = -1;
  
  // Test all 24 keys (12 major + 12 minor)
  for (let root = 0; root < 12; root++) {
    // Major key
    const majorCorr = correlate(chroma, rotateArray(majorProfile, root));
    if (majorCorr > bestConfidence) {
      bestConfidence = majorCorr;
      bestKey = PITCH_CLASSES[root];
    }
    
    // Minor key
    const minorCorr = correlate(chroma, rotateArray(minorProfile, root));
    if (minorCorr > bestConfidence) {
      bestConfidence = minorCorr;
      bestKey = PITCH_CLASSES[root] + 'm';
    }
  }
  
  return { key: bestKey, confidence: Math.max(0, bestConfidence) };
}

function correlate(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, val) => sum + val, 0) / a.length;
  const meanB = b.reduce((sum, val) => sum + val, 0) / b.length;
  
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }
  
  return denomA * denomB === 0 ? 0 : numerator / Math.sqrt(denomA * denomB);
}

function rotateArray<T>(arr: T[], n: number): T[] {
  const len = arr.length;
  const rotation = ((n % len) + len) % len;
  return [...arr.slice(rotation), ...arr.slice(0, rotation)];
}