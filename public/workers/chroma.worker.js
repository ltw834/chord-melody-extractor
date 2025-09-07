// Chroma Worker - Standalone JavaScript version
// This file includes all dependencies inlined to work in the browser

// Pitch utilities inlined
function frequencyToChroma(frequencies, sampleRate) {
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

// FFT implementation for Web Worker
function fft(signal) {
  const N = signal.length;
  const real = new Array(N);
  const imag = new Array(N);
  
  // Initialize
  for (let i = 0; i < N; i++) {
    real[i] = signal[i];
    imag[i] = 0;
  }
  
  // Bit-reverse permutation
  let j = 0;
  for (let i = 1; i < N - 1; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  
  // FFT computation
  for (let len = 2; len <= N; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlen_real = Math.cos(angle);
    const wlen_imag = Math.sin(angle);
    
    for (let i = 0; i < N; i += len) {
      let w_real = 1;
      let w_imag = 0;
      
      for (let j = 0; j < len / 2; j++) {
        const u_real = real[i + j];
        const u_imag = imag[i + j];
        const v_real = real[i + j + len / 2] * w_real - imag[i + j + len / 2] * w_imag;
        const v_imag = real[i + j + len / 2] * w_imag + imag[i + j + len / 2] * w_real;
        
        real[i + j] = u_real + v_real;
        imag[i + j] = u_imag + v_imag;
        real[i + j + len / 2] = u_real - v_real;
        imag[i + j + len / 2] = u_imag - v_imag;
        
        const temp_real = w_real * wlen_real - w_imag * wlen_imag;
        w_imag = w_real * wlen_imag + w_imag * wlen_real;
        w_real = temp_real;
      }
    }
  }
  
  return { real, imag };
}

function applyHammingWindow(signal) {
  const N = signal.length;
  const windowed = new Array(N);
  
  for (let i = 0; i < N; i++) {
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    windowed[i] = signal[i] * window;
  }
  
  return windowed;
}

function computeMagnitudeSpectrum(real, imag) {
  const magnitudes = new Array(real.length / 2);
  
  for (let i = 0; i < magnitudes.length; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  return magnitudes;
}

function processAudioFrame(input) {
  const { audioData, sampleRate, frameSize, timestamp } = input;
  
  // Pad to next power of 2 for FFT
  const fftSize = Math.pow(2, Math.ceil(Math.log2(frameSize)));
  const paddedSignal = new Array(fftSize).fill(0);
  
  // Copy audio data and apply windowing
  for (let i = 0; i < Math.min(frameSize, audioData.length); i++) {
    paddedSignal[i] = audioData[i];
  }
  
  const windowedSignal = applyHammingWindow(paddedSignal);
  
  // Compute FFT
  const { real, imag } = fft(windowedSignal);
  const magnitudes = computeMagnitudeSpectrum(real, imag);
  
  // Convert to chroma
  const chroma = frequencyToChroma(magnitudes, sampleRate);
  
  // Calculate confidence based on energy and spectral clarity
  const energy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0) / magnitudes.length;
  const spectralCentroid = magnitudes.reduce((sum, mag, i) => sum + mag * i, 0) / 
                          magnitudes.reduce((sum, mag) => sum + mag, 0);
  
  const confidence = Math.min(1, Math.max(0, 
    Math.log10(energy + 1e-10) / 5 + 0.5 +
    (spectralCentroid > 10 ? 0.2 : -0.1)
  ));
  
  return {
    chroma,
    timestamp,
    confidence
  };
}

// Main worker message handler
self.onmessage = function(e) {
  try {
    const result = processAudioFrame(e.data);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unknown error in chroma worker'
    });
  }
};