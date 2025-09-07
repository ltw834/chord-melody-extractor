export class Metronome {
  private ctx: AudioContext | null = null;
  private nextTickTime = 0;
  private isRunning = false;
  private bpm = 120;
  private intervalId: number | null = null;

  constructor(bpm = 120) {
    this.bpm = bpm;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  start() {
    if (this.isRunning) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.nextTickTime = this.ctx.currentTime + 0.05;
    this.isRunning = true;
    // Schedule ticks in small chunks
    const scheduler = () => {
      if (!this.isRunning || !this.ctx) return;
      while (this.nextTickTime < this.ctx.currentTime + 0.1) {
        this.scheduleTick(this.nextTickTime);
        this.nextTickTime += 60.0 / this.bpm; // quarter notes
      }
    };
    this.intervalId = window.setInterval(scheduler, 25);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  private scheduleTick(time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

