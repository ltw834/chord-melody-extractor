import { TimelineSegment } from '@/components/Timeline';

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NASHVILLE_NUMBERS = ['1', '♭2', '2', '♭3', '3', '4', '♯4/♭5', '5', '♭6', '6', '♭7', '7'];

export function transposeChord(chordName: string, semitones: number): string {
  if (chordName === 'N/C' || !chordName) return chordName;
  
  // Extract root note
  const rootMatch = chordName.match(/^([A-G][#b]?)/);
  if (!rootMatch) return chordName;
  
  const root = rootMatch[1];
  const quality = chordName.replace(root, '');
  
  // Find current pitch class index
  let currentIndex = PITCH_CLASSES.indexOf(root);
  if (currentIndex === -1) {
    // Handle flats
    const flatMap: { [key: string]: number } = {
      'Db': 1, 'Eb': 3, 'Gb': 6, 'Ab': 8, 'Bb': 10
    };
    currentIndex = flatMap[root] || 0;
  }
  
  // Transpose
  const newIndex = (currentIndex + semitones + 12) % 12;
  const newRoot = PITCH_CLASSES[newIndex];
  
  return newRoot + quality;
}

export function applyCapo(chordName: string, capoFret: number): string {
  // Capo effectively transposes down
  return transposeChord(chordName, -capoFret);
}

export function toNashville(chordName: string, key: string): string {
  if (chordName === 'N/C' || !chordName || !key) return chordName;
  
  // Extract root note from chord
  const rootMatch = chordName.match(/^([A-G][#b]?)/);
  if (!rootMatch) return chordName;
  
  const chordRoot = rootMatch[1];
  const quality = chordName.replace(chordRoot, '');
  
  // Extract root note from key
  const keyRoot = key.replace(/m$/, ''); // Remove minor indicator
  const isMinorKey = key.endsWith('m');
  
  // Find interval from key to chord
  let keyIndex = PITCH_CLASSES.indexOf(keyRoot);
  let chordIndex = PITCH_CLASSES.indexOf(chordRoot);
  
  if (keyIndex === -1 || chordIndex === -1) return chordName;
  
  const interval = (chordIndex - keyIndex + 12) % 12;
  let nashvilleNumber = NASHVILLE_NUMBERS[interval];
  
  // Adjust for minor key context
  if (isMinorKey) {
    const minorAdjustments: { [key: number]: string } = {
      0: '1', 1: '♭2', 2: '♭3', 3: '3', 4: '4', 5: '♭5', 
      6: '5', 7: '♭6', 8: '6', 9: '♭7', 10: '7', 11: '7+'
    };
    nashvilleNumber = minorAdjustments[interval] || nashvilleNumber;
  }
  
  return nashvilleNumber + quality;
}

export interface ExportOptions {
  transpose?: number;
  capoFret?: number;
  useNashville?: boolean;
  key?: string;
  includeTimestamps?: boolean;
  includeConfidence?: boolean;
}

export function formatChordSheet(segments: TimelineSegment[], options: ExportOptions = {}): string {
  if (segments.length === 0) {
    return 'No chords detected.';
  }
  
  let output = '';
  
  // Header
  if (options.key) {
    output += `Key: ${options.key}\n`;
  }
  if (options.capoFret) {
    output += `Capo: Fret ${options.capoFret}\n`;
  }
  if (options.transpose) {
    output += `Transposed: ${options.transpose > 0 ? '+' : ''}${options.transpose} semitones\n`;
  }
  output += '\n';
  
  // Group segments by timing for chord sheet format
  let currentLine = '';
  let lastEndTime = 0;
  let measureCount = 0;
  
  for (const segment of segments) {
    let chord = segment.chord;
    
    // Apply transformations
    if (options.transpose) {
      chord = transposeChord(chord, options.transpose);
    }
    if (options.capoFret) {
      chord = applyCapo(chord, options.capoFret);
    }
    if (options.useNashville && options.key) {
      chord = toNashville(chord, options.key);
    }
    
    // Format chord with optional info
    let chordDisplay = chord;
    if (options.includeTimestamps) {
      chordDisplay += ` (${Math.floor(segment.startTime)}s)`;
    }
    if (options.includeConfidence) {
      chordDisplay += ` [${Math.round(segment.confidence * 100)}%]`;
    }
    
    // Add to current line
    if (currentLine.length === 0) {
      currentLine = chordDisplay;
    } else {
      currentLine += '  ' + chordDisplay;
    }
    
    // Break line every 4-6 chords or based on timing
    measureCount++;
    const duration = segment.endTime - segment.startTime;
    
    if (measureCount >= 4 || currentLine.length > 60 || duration > 8) {
      output += currentLine + '\n';
      currentLine = '';
      measureCount = 0;
    }
    
    lastEndTime = segment.endTime;
  }
  
  // Add remaining chords
  if (currentLine) {
    output += currentLine + '\n';
  }
  
  return output.trim();
}

export function formatChordSheetWithSections(segments: TimelineSegment[], options: ExportOptions = {}): string {
  if (segments.length === 0) {
    return 'No chords detected.';
  }
  
  // Detect potential song sections based on chord patterns and timing
  const sections = detectSections(segments);
  
  let output = '';
  
  // Header
  if (options.key) {
    output += `Key: ${options.key}\n`;
  }
  if (options.capoFret) {
    output += `Capo: Fret ${options.capoFret}\n`;
  }
  output += '\n';
  
  // Format each section
  for (const section of sections) {
    output += `[${section.name}]\n`;
    
    const sectionSegments = segments.slice(section.startIndex, section.endIndex + 1);
    const sectionSheet = formatChordSheet(sectionSegments, { ...options, includeTimestamps: false });
    
    output += sectionSheet + '\n\n';
  }
  
  return output.trim();
}

interface Section {
  name: string;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
}

function detectSections(segments: TimelineSegment[]): Section[] {
  const sections: Section[] = [];
  let currentSection = 0;
  let sectionNames = ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Bridge', 'Outro'];
  
  // Simple section detection based on timing gaps
  let lastEndTime = 0;
  let sectionStart = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const timGap = segment.startTime - lastEndTime;
    
    // If there's a significant gap (>2 seconds), start new section
    if (timGap > 2 && i > 0) {
      sections.push({
        name: sectionNames[currentSection % sectionNames.length],
        startIndex: sectionStart,
        endIndex: i - 1,
        startTime: segments[sectionStart].startTime,
        endTime: segments[i - 1].endTime
      });
      
      sectionStart = i;
      currentSection++;
    }
    
    lastEndTime = segment.endTime;
  }
  
  // Add final section
  if (sectionStart < segments.length) {
    sections.push({
      name: sectionNames[currentSection % sectionNames.length],
      startIndex: sectionStart,
      endIndex: segments.length - 1,
      startTime: segments[sectionStart].startTime,
      endTime: segments[segments.length - 1].endTime
    });
  }
  
  return sections;
}

export function exportToJSON(segments: TimelineSegment[], options: ExportOptions = {}): string {
  const processedSegments = segments.map(segment => {
    let chord = segment.chord;
    
    if (options.transpose) {
      chord = transposeChord(chord, options.transpose);
    }
    if (options.capoFret) {
      chord = applyCapo(chord, options.capoFret);
    }
    
    return {
      chord,
      originalChord: segment.chord,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.endTime - segment.startTime,
      confidence: segment.confidence
    };
  });
  
  const exportData = {
    chords: processedSegments,
    metadata: {
      totalDuration: segments.length > 0 ? segments[segments.length - 1].endTime : 0,
      totalChords: segments.length,
      exportOptions: options,
      exportedAt: new Date().toISOString()
    }
  };
  
  return JSON.stringify(exportData, null, 2);
}