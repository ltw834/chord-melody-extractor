export interface TempoEstimate {
  bpm: number;
  confidence: number;
}

export class TempoDetector {
  private onsetTimes: number[] = [];
  private lastEnergy = 0;
  private readonly maxOnsets = 50;
  private readonly onsetThreshold = 0.1;

  addAudioFrame(audioData: Float32Array, timestamp: number): void {
    const energy = this.computeSpectralEnergy(audioData);
    
    // Simple onset detection based on energy increase
    if (energy > this.lastEnergy * (1 + this.onsetThreshold)) {
      this.onsetTimes.push(timestamp);
      
      if (this.onsetTimes.length > this.maxOnsets) {
        this.onsetTimes.shift();
      }
    }
    
    this.lastEnergy = energy;
  }

  getCurrentTempo(): TempoEstimate {
    if (this.onsetTimes.length < 4) {
      return { bpm: 120, confidence: 0 };
    }

    // Calculate intervals between onsets
    const intervals: number[] = [];
    for (let i = 1; i < this.onsetTimes.length; i++) {
      intervals.push(this.onsetTimes[i] - this.onsetTimes[i-1]);
    }

    // Find most common interval (tempo period)
    const bpmCandidates = intervals
      .map(interval => 60 / interval)
      .filter(bpm => bpm >= 60 && bpm <= 200); // Reasonable BPM range

    if (bpmCandidates.length === 0) {
      return { bpm: 120, confidence: 0 };
    }

    // Group similar BPMs and find the most frequent
    const bpmGroups = this.groupSimilarBPMs(bpmCandidates);
    const mostFrequentGroup = bpmGroups.reduce((a, b) => 
      a.count > b.count ? a : b
    );

    const confidence = mostFrequentGroup.count / bpmCandidates.length;

    return {
      bpm: Math.round(mostFrequentGroup.avgBpm),
      confidence: Math.min(1, confidence * 2) // Scale confidence
    };
  }

  private computeSpectralEnergy(audioData: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    return Math.sqrt(energy / audioData.length);
  }

  private groupSimilarBPMs(bpms: number[]): Array<{avgBpm: number; count: number}> {
    const tolerance = 5; // BPM tolerance for grouping
    const groups: Array<{bpms: number[]; avgBpm: number; count: number}> = [];

    for (const bpm of bpms) {
      let foundGroup = false;
      
      for (const group of groups) {
        if (Math.abs(bpm - group.avgBpm) <= tolerance) {
          group.bpms.push(bpm);
          group.avgBpm = group.bpms.reduce((a, b) => a + b, 0) / group.bpms.length;
          group.count = group.bpms.length;
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups.push({
          bpms: [bpm],
          avgBpm: bpm,
          count: 1
        });
      }
    }

    return groups;
  }

  reset(): void {
    this.onsetTimes = [];
    this.lastEnergy = 0;
  }
}