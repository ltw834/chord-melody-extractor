export interface TempoEstimate {
  bpm: number;
  confidence: number;
}

export interface BeatInfo {
  bpm: number;
  confidence: number;
  downbeatOffset: number; // seconds offset into beat period [0, beatSec)
  timeSignature: { numerator: number; denominator: number };
}

export class TempoDetector {
  // store recent detected onsets with their energy
  private onsetEvents: Array<{ t: number; energy: number }> = [];
  private lastEnergy = 0;
  private readonly maxOnsets = 200;
  private readonly onsetThreshold = 0.12;

  addAudioFrame(audioData: Float32Array, timestamp: number): void {
    const energy = this.computeSpectralEnergy(audioData);

    // simple onset heuristic: energy jump
    if (energy > this.lastEnergy * (1 + this.onsetThreshold) && energy > 1e-4) {
      this.onsetEvents.push({ t: timestamp, energy });
      if (this.onsetEvents.length > this.maxOnsets) this.onsetEvents.shift();
    }

    this.lastEnergy = energy;
  }

  // Backwards-compatible tempo-only method
  getCurrentTempo(): TempoEstimate {
    const info = this.getBeatInfo();
    return { bpm: info.bpm, confidence: info.confidence };
  }

  // Estimate beat info: bpm, confidence, downbeat phase and a simple time signature guess
  getBeatInfo(): BeatInfo {
    if (this.onsetEvents.length < 4) {
      return { bpm: 120, confidence: 0, downbeatOffset: 0, timeSignature: { numerator: 4, denominator: 4 } };
    }

    // Build intervals between onsets
    const intervals: number[] = [];
    for (let i = 1; i < this.onsetEvents.length; i++) {
      intervals.push(this.onsetEvents[i].t - this.onsetEvents[i - 1].t);
    }

    // Candidate BPMs from intervals
    const bpmCandidates = intervals.map(iv => 60 / iv).filter(b => b >= 50 && b <= 200);
    if (bpmCandidates.length === 0) {
      return { bpm: 120, confidence: 0, downbeatOffset: 0, timeSignature: { numerator: 4, denominator: 4 } };
    }

    const groups = this.groupSimilarBPMs(bpmCandidates);
    const best = groups.reduce((a, b) => (a.count > b.count ? a : b));
    const bpm = Math.round(best.avgBpm);
    const confidence = Math.min(1, best.count / bpmCandidates.length * 1.5);

    const beatSec = 60 / Math.max(1, bpm);

    // Phase histogram of onsets modulo beatSec
    const nbins = 32;
    const bins = new Array(nbins).fill(0);
    for (const ev of this.onsetEvents) {
      const phase = (ev.t % beatSec) / beatSec; // 0..1
      const idx = Math.floor(phase * nbins) % nbins;
      bins[idx] += ev.energy;
    }

    // find peak phase as downbeat offset
    let maxIdx = 0;
    for (let i = 1; i < nbins; i++) if (bins[i] > bins[maxIdx]) maxIdx = i;
    const downbeatOffset = (maxIdx + 0.5) / nbins * beatSec;

    // Simple time-signature heuristic: test 3,4,6
    const candidates = [3, 4, 6];
    let bestSig = 4;
    let bestScore = -Infinity;
    const totalEnergy = this.onsetEvents.reduce((s, e) => s + e.energy, 0) || 1e-9;

    for (const numer of candidates) {
      // accumulate energy at positions corresponding to beat index 0 across successive bars
      let score = 0;
      for (const ev of this.onsetEvents) {
        const rel = (ev.t - downbeatOffset) / beatSec;
        const pos = ((rel % numer) + numer) % numer; // 0..numer
        // closer to 0 means likely downbeat
        const weight = Math.max(0, 1 - Math.min(Math.abs(pos), Math.abs(pos - numer)) / (numer / 2));
        score += ev.energy * weight;
      }
      // normalize
      score = score / totalEnergy;
      if (score > bestScore) { bestScore = score; bestSig = numer; }
    }

    return {
      bpm,
      confidence,
      downbeatOffset: downbeatOffset % beatSec,
      timeSignature: { numerator: bestSig, denominator: 4 }
    };
  }

  private computeSpectralEnergy(audioData: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) energy += audioData[i] * audioData[i];
    return Math.sqrt(energy / audioData.length);
  }

  private groupSimilarBPMs(bpms: number[]): Array<{avgBpm: number; count: number}> {
    const tolerance = 4; // BPM tolerance
    const groups: Array<{bpms: number[]; avgBpm: number; count: number}> = [];
    for (const bpm of bpms) {
      let found = false;
      for (const g of groups) {
        if (Math.abs(bpm - g.avgBpm) <= tolerance) {
          g.bpms.push(bpm);
          g.avgBpm = g.bpms.reduce((a, b) => a + b, 0) / g.bpms.length;
          g.count = g.bpms.length; found = true; break;
        }
      }
      if (!found) groups.push({ bpms: [bpm], avgBpm: bpm, count: 1 });
    }
    return groups;
  }

  reset(): void {
    this.onsetEvents = [];
    this.lastEnergy = 0;
  }
}