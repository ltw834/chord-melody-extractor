export interface MicrophoneConfig {
  sampleRate?: number;
  channels?: number;
  bufferSize?: number;
  constraints?: MediaStreamConstraints;
}

export interface MicrophoneState {
  isRecording: boolean;
  hasPermission: boolean;
  error: string | null;
  stream: MediaStream | null;
}

export class MicrophoneManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  
  private config: Required<MicrophoneConfig>;
  private onAudioData?: (audioData: Float32Array, timestamp: number) => void;
  private onStateChange?: (state: MicrophoneState) => void;
  
  private state: MicrophoneState = {
    isRecording: false,
    hasPermission: false,
    error: null,
    stream: null
  };

  constructor(config: MicrophoneConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate || 44100,
      channels: config.channels || 1,
      bufferSize: config.bufferSize || 4096,
      constraints: config.constraints || {
        audio: {
          sampleRate: config.sampleRate || 44100,
          channelCount: config.channels || 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        },
        video: false
      }
    };
  }

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(this.config.constraints);
      
      // Test successful, close the stream
      stream.getTracks().forEach(track => track.stop());
      
      this.updateState({ hasPermission: true, error: null });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Microphone access denied';
      this.updateState({ hasPermission: false, error: errorMessage });
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    if (this.state.isRecording) {
      return true;
    }

    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Get microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.config.constraints);
      
      // Create audio nodes
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.processor = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);
      this.gainNode = this.audioContext.createGain();
      
      // Configure analyser
      this.analyser.fftSize = Math.min(this.config.bufferSize * 2, 32768);
      this.analyser.smoothingTimeConstant = 0.3;
      
      // Set up processing chain
      source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      // Process audio data
      this.processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const audioData = inputBuffer.getChannelData(0);
        const timestamp = this.audioContext!.currentTime;
        
        if (this.onAudioData) {
          this.onAudioData(new Float32Array(audioData), timestamp);
        }
      };
      
      this.updateState({ 
        isRecording: true, 
        hasPermission: true, 
        error: null, 
        stream: this.mediaStream 
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      this.updateState({ isRecording: false, error: errorMessage });
      return false;
    }
  }

  stopRecording(): void {
    if (!this.state.isRecording) {
      return;
    }

    // Clean up audio nodes
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.updateState({ 
      isRecording: false, 
      error: null, 
      stream: null 
    });
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return average / 255; // Normalize to 0-1
  }

  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(2, gain)), this.audioContext!.currentTime);
    }
  }

  onAudioDataReceived(callback: (audioData: Float32Array, timestamp: number) => void): void {
    this.onAudioData = callback;
  }

  onStateChanged(callback: (state: MicrophoneState) => void): void {
    this.onStateChange = callback;
  }

  getState(): MicrophoneState {
    return { ...this.state };
  }

  private updateState(newState: Partial<MicrophoneState>): void {
    this.state = { ...this.state, ...newState };
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  dispose(): void {
    this.stopRecording();
    this.onAudioData = undefined;
    this.onStateChange = undefined;
  }
}