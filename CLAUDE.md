# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
The project is ChordSnap, a real-time chord recognition and transcription web app.

## Development Commands

```bash
# Development server
npm run dev        # starts Next.js app (port 3000 by default)

# Build & production
npm run build      # Next.js production build
npm run start      # run production server

# Linting & testing
npm run lint
npm test
npm run test:watch

# Focused tests
npm test -- --testPathPattern=templates
npm test -- --testPathPattern=audio
```

## Architecture

**Dual stack:**
- Next.js web application (primary)
- Python backend (optional, Omnizart integration)

**Next.js app layout:**
```
src/
├── app/                          # Next.js App Router
│   ├── api/transcribe/route.ts   # Omnizart/Whisper integration
│   └── page.tsx                  # Main UI
├── lib/audio/index.ts            # AudioProcessor (core pipeline)
├── lib/audio/workerClient.ts     # Worker bridge
├── lib/chords/templates.ts       # Template matching
├── lib/chords/vocab.ts           # Chord vocabulary
├── store/useAppStore.ts          # Zustand global state
├── workers/chroma.worker.ts      # FFT + chroma extraction
└── components/                   # React UI components
```

**Python (legacy):**
- Omnizart wrapper, optional server-side processing
- Not required for normal dev flow

## Audio Processing Pipeline

`src/lib/audio/index.ts` (AudioProcessor):
1. **Input**: mic stream or file upload
2. **Frames**: windowed FFT
3. **Chroma extraction**: via worker
4. **Chord matching**: template similarity
5. **Quantization**: snap to beats
6. **State update**: stored in Zustand

## ⚠️ CRITICAL: Chord Vocabulary (DEFAULT = EXTENDED)

**Claude must always use the extended vocabulary unless explicitly told otherwise:**
- Triads: maj, min, dim, aug
- 7ths: maj7, min7, dom7, half-dim7
- 9ths, 11ths, 13ths
- Suspended: sus2, sus4
- Inversions: root, 1st, 2nd, 3rd (where applicable)

Defined in `src/lib/chords/vocab.ts`. **Never default to basic triads.**

## ⚠️ CRITICAL: UI / Interface Rules

**The core interface must show chords in a measure grid, not plain text:**
- Timeline divided into measures (bars)
- Each measure = row of squares (beats)
- Chords displayed inside squares aligned to beats
- User can see the progression across bars at a glance

**Think: Ableton/Logic style grid → each bar visualized.**

## React UI Specification: Chord Grid Component

**Required component structure:**

```tsx
// ChordGrid.tsx - Main measure grid display
interface ChordGridProps {
  segments: TimelineSegment[];
  currentTime: number;
  beatsPerMeasure: number; // default 4
  measureCount: number;
  onChordClick?: (measureIndex: number, beatIndex: number) => void;
}

// GridMeasure.tsx - Single measure row
interface GridMeasureProps {
  measureIndex: number;
  beats: ChordBeat[];
  isPlaying: boolean;
  currentBeat?: number;
}

// ChordSquare.tsx - Individual beat square
interface ChordSquareProps {
  chord: string;
  confidence: number;
  isActive: boolean;
  onClick?: () => void;
}
```

**Layout specifications:**
- Each measure = horizontal row of beat squares
- 4 squares per measure (4/4 time signature)
- Square size: 64x64px minimum
- Gap between squares: 4px
- Chord text centered in square
- Active beat highlighted with border/background
- Low confidence chords shown with opacity

**Implementation Example:**

```tsx
// ChordGrid.tsx
import { TimelineSegment } from './Timeline';

interface ChordBeat {
  chord: string;
  confidence: number;
  startTime: number;
}

export function ChordGrid({ 
  segments, 
  currentTime, 
  beatsPerMeasure = 4,
  tempo = 120 
}: ChordGridProps) {
  const beatDuration = 60 / tempo; // seconds per beat
  const measureDuration = beatDuration * beatsPerMeasure;
  const measureCount = Math.ceil(segments[segments.length - 1]?.endTime / measureDuration) || 8;

  const convertSegmentsToGrid = (segments: TimelineSegment[]) => {
    const grid: ChordBeat[][] = Array(measureCount).fill(null).map(() => 
      Array(beatsPerMeasure).fill({ chord: '', confidence: 0, startTime: 0 })
    );

    segments.forEach(segment => {
      const startMeasure = Math.floor(segment.startTime / measureDuration);
      const startBeat = Math.floor((segment.startTime % measureDuration) / beatDuration);
      
      if (startMeasure < measureCount && startBeat < beatsPerMeasure) {
        grid[startMeasure][startBeat] = {
          chord: segment.chord,
          confidence: segment.confidence,
          startTime: segment.startTime
        };
      }
    });

    return grid;
  };

  const gridData = convertSegmentsToGrid(segments);
  const currentMeasure = Math.floor(currentTime / measureDuration);
  const currentBeat = Math.floor((currentTime % measureDuration) / beatDuration);

  return (
    <div className="chord-grid">
      {gridData.map((measure, measureIndex) => (
        <div key={measureIndex} className="measure-row">
          <div className="measure-number">{measureIndex + 1}</div>
          <div className="beats-container">
            {measure.map((beat, beatIndex) => (
              <ChordSquare
                key={`${measureIndex}-${beatIndex}`}
                chord={beat.chord}
                confidence={beat.confidence}
                isActive={measureIndex === currentMeasure && beatIndex === currentBeat}
                onClick={() => console.log(`Clicked measure ${measureIndex + 1}, beat ${beatIndex + 1}`)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ChordSquare.tsx
export function ChordSquare({ chord, confidence, isActive, onClick }: ChordSquareProps) {
  return (
    <button
      className={`chord-square ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        opacity: confidence < 0.5 ? 0.6 : 1,
        backgroundColor: isActive ? '#3b82f6' : '#f3f4f6',
        border: isActive ? '2px solid #1d4ed8' : '1px solid #d1d5db'
      }}
    >
      <span className="chord-text">
        {chord || '—'}
      </span>
    </button>
  );
}
```

**CSS for grid layout:**
```css
.chord-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.measure-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.measure-number {
  width: 32px;
  text-align: right;
  font-weight: bold;
  color: #6b7280;
}

.beats-container {
  display: flex;
  gap: 4px;
}

.chord-square {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chord-square:hover {
  transform: scale(1.05);
}

.chord-square.active {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

## State Management

`useAppStore.ts` tracks:
- **Current chord** (extended vocab)
- **Measure grid + timeline**
- Playback state
- Audio settings (tempo, tuning, smoothing)

**Key selectors:**
```typescript
const segments = useAppStore(state => state.segments);
const currentTime = useAppStore(state => state.currentTime);
const settings = useAppStore(state => state.settings);
```

## API & Integration

- `/api/transcribe`: optional Whisper/Omnizart transcription
- `/api/resolve-url`: for YouTube/SoundCloud fetch (scaffolded)

## Known Issues

- **Omnizart is optional** (not ARM-native). Default to JS chord engine.
- **Must prioritize extended vocab + measure grid UI** over legacy code.

## Performance Targets

- Real-time: 50–150ms latency
- UI must not block → chroma runs in worker
- Grid updates in sync with audio playback

## ✅ Action Rules for Claude:

1. **Always use extended chord vocabulary** (`vocabularyLevel: 'extended'` or `'rich'`)
2. **Render output in measure grid** (squares per bar), not raw text
3. **Prioritize JS/TS path** (AudioProcessor, templates.ts) over Python unless Omnizart explicitly requested
4. **When building UI**, create ChordGrid component with beat squares
5. **Default settings**: extended chords, 4/4 time, measure-based quantization