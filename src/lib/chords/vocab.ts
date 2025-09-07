export interface ChordDefinition {
  name: string;
  intervals: number[];
  quality: 'major' | 'minor' | 'dominant' | 'diminished' | 'augmented' | 'suspended';
  level: 'basic' | 'extended' | 'rich';
}

export const CHORD_DEFINITIONS: ChordDefinition[] = [
  // Basic - Major and Minor triads
  { name: 'C', intervals: [0, 4, 7], quality: 'major', level: 'basic' },
  { name: 'C#', intervals: [1, 5, 8], quality: 'major', level: 'basic' },
  { name: 'D', intervals: [2, 6, 9], quality: 'major', level: 'basic' },
  { name: 'D#', intervals: [3, 7, 10], quality: 'major', level: 'basic' },
  { name: 'E', intervals: [4, 8, 11], quality: 'major', level: 'basic' },
  { name: 'F', intervals: [5, 9, 0], quality: 'major', level: 'basic' },
  { name: 'F#', intervals: [6, 10, 1], quality: 'major', level: 'basic' },
  { name: 'G', intervals: [7, 11, 2], quality: 'major', level: 'basic' },
  { name: 'G#', intervals: [8, 0, 3], quality: 'major', level: 'basic' },
  { name: 'A', intervals: [9, 1, 4], quality: 'major', level: 'basic' },
  { name: 'A#', intervals: [10, 2, 5], quality: 'major', level: 'basic' },
  { name: 'B', intervals: [11, 3, 6], quality: 'major', level: 'basic' },

  { name: 'Cm', intervals: [0, 3, 7], quality: 'minor', level: 'basic' },
  { name: 'C#m', intervals: [1, 4, 8], quality: 'minor', level: 'basic' },
  { name: 'Dm', intervals: [2, 5, 9], quality: 'minor', level: 'basic' },
  { name: 'D#m', intervals: [3, 6, 10], quality: 'minor', level: 'basic' },
  { name: 'Em', intervals: [4, 7, 11], quality: 'minor', level: 'basic' },
  { name: 'Fm', intervals: [5, 8, 0], quality: 'minor', level: 'basic' },
  { name: 'F#m', intervals: [6, 9, 1], quality: 'minor', level: 'basic' },
  { name: 'Gm', intervals: [7, 10, 2], quality: 'minor', level: 'basic' },
  { name: 'G#m', intervals: [8, 11, 3], quality: 'minor', level: 'basic' },
  { name: 'Am', intervals: [9, 0, 4], quality: 'minor', level: 'basic' },
  { name: 'A#m', intervals: [10, 1, 5], quality: 'minor', level: 'basic' },
  { name: 'Bm', intervals: [11, 2, 6], quality: 'minor', level: 'basic' },

  // Extended - 7th chords
  { name: 'C7', intervals: [0, 4, 7, 10], quality: 'dominant', level: 'extended' },
  { name: 'C#7', intervals: [1, 5, 8, 11], quality: 'dominant', level: 'extended' },
  { name: 'D7', intervals: [2, 6, 9, 0], quality: 'dominant', level: 'extended' },
  { name: 'D#7', intervals: [3, 7, 10, 1], quality: 'dominant', level: 'extended' },
  { name: 'E7', intervals: [4, 8, 11, 2], quality: 'dominant', level: 'extended' },
  { name: 'F7', intervals: [5, 9, 0, 3], quality: 'dominant', level: 'extended' },
  { name: 'F#7', intervals: [6, 10, 1, 4], quality: 'dominant', level: 'extended' },
  { name: 'G7', intervals: [7, 11, 2, 5], quality: 'dominant', level: 'extended' },
  { name: 'G#7', intervals: [8, 0, 3, 6], quality: 'dominant', level: 'extended' },
  { name: 'A7', intervals: [9, 1, 4, 7], quality: 'dominant', level: 'extended' },
  { name: 'A#7', intervals: [10, 2, 5, 8], quality: 'dominant', level: 'extended' },
  { name: 'B7', intervals: [11, 3, 6, 9], quality: 'dominant', level: 'extended' },

  { name: 'Cmaj7', intervals: [0, 4, 7, 11], quality: 'major', level: 'extended' },
  { name: 'C#maj7', intervals: [1, 5, 8, 0], quality: 'major', level: 'extended' },
  { name: 'Dmaj7', intervals: [2, 6, 9, 1], quality: 'major', level: 'extended' },
  { name: 'D#maj7', intervals: [3, 7, 10, 2], quality: 'major', level: 'extended' },
  { name: 'Emaj7', intervals: [4, 8, 11, 3], quality: 'major', level: 'extended' },
  { name: 'Fmaj7', intervals: [5, 9, 0, 4], quality: 'major', level: 'extended' },
  { name: 'F#maj7', intervals: [6, 10, 1, 5], quality: 'major', level: 'extended' },
  { name: 'Gmaj7', intervals: [7, 11, 2, 6], quality: 'major', level: 'extended' },
  { name: 'G#maj7', intervals: [8, 0, 3, 7], quality: 'major', level: 'extended' },
  { name: 'Amaj7', intervals: [9, 1, 4, 8], quality: 'major', level: 'extended' },
  { name: 'A#maj7', intervals: [10, 2, 5, 9], quality: 'major', level: 'extended' },
  { name: 'Bmaj7', intervals: [11, 3, 6, 10], quality: 'major', level: 'extended' },

  { name: 'Cm7', intervals: [0, 3, 7, 10], quality: 'minor', level: 'extended' },
  { name: 'C#m7', intervals: [1, 4, 8, 11], quality: 'minor', level: 'extended' },
  { name: 'Dm7', intervals: [2, 5, 9, 0], quality: 'minor', level: 'extended' },
  { name: 'D#m7', intervals: [3, 6, 10, 1], quality: 'minor', level: 'extended' },
  { name: 'Em7', intervals: [4, 7, 11, 2], quality: 'minor', level: 'extended' },
  { name: 'Fm7', intervals: [5, 8, 0, 3], quality: 'minor', level: 'extended' },
  { name: 'F#m7', intervals: [6, 9, 1, 4], quality: 'minor', level: 'extended' },
  { name: 'Gm7', intervals: [7, 10, 2, 5], quality: 'minor', level: 'extended' },
  { name: 'G#m7', intervals: [8, 11, 3, 6], quality: 'minor', level: 'extended' },
  { name: 'Am7', intervals: [9, 0, 4, 7], quality: 'minor', level: 'extended' },
  { name: 'A#m7', intervals: [10, 1, 5, 8], quality: 'minor', level: 'extended' },
  { name: 'Bm7', intervals: [11, 2, 6, 9], quality: 'minor', level: 'extended' },

  // Rich - Extended chords
  { name: 'Csus2', intervals: [0, 2, 7], quality: 'suspended', level: 'rich' },
  { name: 'Csus4', intervals: [0, 5, 7], quality: 'suspended', level: 'rich' },
  { name: 'Cdim', intervals: [0, 3, 6], quality: 'diminished', level: 'rich' },
  { name: 'Caug', intervals: [0, 4, 8], quality: 'augmented', level: 'rich' },
  { name: 'Cadd9', intervals: [0, 2, 4, 7], quality: 'major', level: 'rich' },

  // Add more rich chords for other roots as needed...
];

export type VocabularyLevel = 'basic' | 'extended' | 'rich';

export function getChordsByLevel(level: VocabularyLevel): ChordDefinition[] {
  switch (level) {
    case 'basic':
      return CHORD_DEFINITIONS.filter(chord => chord.level === 'basic');
    case 'extended':
      return CHORD_DEFINITIONS.filter(chord => 
        chord.level === 'basic' || chord.level === 'extended'
      );
    case 'rich':
      return CHORD_DEFINITIONS;
    default:
      return CHORD_DEFINITIONS.filter(chord => chord.level === 'basic');
  }
}

export function getChordIntervals(chordName: string): number[] | null {
  const chord = CHORD_DEFINITIONS.find(c => c.name === chordName);
  return chord ? chord.intervals : null;
}