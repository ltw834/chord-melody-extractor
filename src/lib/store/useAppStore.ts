import { create } from 'zustand';
import { TimelineSegment } from '@/components/Timeline';
import { VocabularyLevel } from '@/lib/chords/vocab';
import { KeyEstimate } from '@/lib/audio/keyDetect';
import { TempoEstimate } from '@/lib/audio/tempoDetect';

export interface AppSettings {
  vocabularyLevel: VocabularyLevel;
  smoothingStrength: number;
  updateRate: number;
  tuningOffset: number; // cents
  capoOffset: number;   // frets
  debugLogging: boolean;
}

export interface AppState {
  // Audio state
  isProcessing: boolean;
  processingProgress: number;
  error: string | null;
  
  // Current chord detection
  currentChord: string;
  currentConfidence: number;
  
  // Timeline and analysis
  segments: TimelineSegment[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  
  // Music analysis
  detectedKey: KeyEstimate | null;
  detectedTempo: TempoEstimate | null;
  
  // Settings
  settings: AppSettings;
  
  // File handling
  uploadedFile: File | null;
  
  // Actions
  setProcessing: (processing: boolean) => void;
  setProcessingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  
  setCurrentChord: (chord: string, confidence: number) => void;
  
  addSegment: (segment: TimelineSegment) => void;
  updateSegments: (segments: TimelineSegment[]) => void;
  clearSegments: () => void;
  
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaying: (playing: boolean) => void;
  
  setDetectedKey: (key: KeyEstimate) => void;
  setDetectedTempo: (tempo: TempoEstimate) => void;
  
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  setUploadedFile: (file: File | null) => void;
  
  reset: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  vocabularyLevel: 'basic',
  smoothingStrength: 0.5,
  updateRate: 20, // Hz
  tuningOffset: 0,
  capoOffset: 0
  ,debugLogging: false
};

const INITIAL_STATE = {
  isProcessing: false,
  processingProgress: 0,
  error: null,
  
  currentChord: 'N/C',
  currentConfidence: 0,
  
  segments: [],
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  
  detectedKey: null,
  detectedTempo: null,
  
  settings: DEFAULT_SETTINGS,
  
  uploadedFile: null
};

export const useAppStore = create<AppState>((set, get) => ({
  ...INITIAL_STATE,
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
  setError: (error) => set({ error }),
  
  setCurrentChord: (chord, confidence) => set({ 
    currentChord: chord, 
    currentConfidence: confidence 
  }),
  
  addSegment: (segment) => set((state) => {
    const segments = [...state.segments];
    
    // Check if we should merge with the last segment
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && 
        lastSegment.chord === segment.chord && 
        Math.abs(lastSegment.endTime - segment.startTime) < 0.1) {
      // Merge segments
      lastSegment.endTime = segment.endTime;
      lastSegment.confidence = Math.max(lastSegment.confidence, segment.confidence);
    } else {
      segments.push(segment);
    }
    
    return { segments };
  }),
  
  updateSegments: (segments) => set({ segments }),
  clearSegments: () => set({ segments: [] }),
  
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  
  setDetectedKey: (detectedKey) => set({ detectedKey }),
  setDetectedTempo: (detectedTempo) => set({ detectedTempo }),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
  
  setUploadedFile: (uploadedFile) => set({ uploadedFile }),
  
  reset: () => set(INITIAL_STATE)
}));

// Selectors for better performance
export const useCurrentChord = () => useAppStore(state => ({ 
  chord: state.currentChord, 
  confidence: state.currentConfidence 
}));
export const useSegments = () => useAppStore(state => state.segments);
export const useSettings = () => useAppStore(state => state.settings);