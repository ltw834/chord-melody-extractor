import { matchChordToChroma, generateChordTemplates } from '@/lib/chords/templates';
import { getChordIntervals } from '@/lib/chords/vocab';

describe('Chord Template Matching', () => {
  describe('generateChordTemplates', () => {
    it('should generate basic chord templates', () => {
      const templates = generateChordTemplates('basic');
      expect(templates.length).toBeGreaterThan(0);
      
      // Should include major and minor chords
      const cMajor = templates.find(t => t.name === 'C');
      const cMinor = templates.find(t => t.name === 'Cm');
      
      expect(cMajor).toBeDefined();
      expect(cMinor).toBeDefined();
      expect(cMajor?.template).toHaveLength(12);
      expect(cMinor?.template).toHaveLength(12);
    });

    it('should generate extended chord templates', () => {
      const templates = generateChordTemplates('extended');
      const c7 = templates.find(t => t.name === 'C7');
      const cmaj7 = templates.find(t => t.name === 'Cmaj7');
      
      expect(c7).toBeDefined();
      expect(cmaj7).toBeDefined();
    });
  });

  describe('matchChordToChroma', () => {
    it('should match C major chord correctly', () => {
      // C major chord chroma: strong C, E, G
      const cMajorChroma = [1.0, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0];
      
      const match = matchChordToChroma(cMajorChroma, 'basic');
      
      expect(match.name).toBe('C');
      expect(match.confidence).toBeGreaterThan(0.5);
    });

    it('should match A minor chord correctly', () => {
      // A minor chord chroma: strong A, C, E
      const aMinorChroma = [0.8, 0, 0, 0, 0.7, 0, 0, 0, 0, 1.0, 0, 0];
      
      const match = matchChordToChroma(aMinorChroma, 'basic');
      
      expect(match.name).toBe('Am');
      expect(match.confidence).toBeGreaterThan(0.5);
    });

    it('should return N/C for noise or unclear input', () => {
      // Random noise chroma
      const noiseChroma = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
      
      const match = matchChordToChroma(noiseChroma, 'basic');
      
      expect(match.confidence).toBeLessThan(0.5);
    });

    it('should handle empty chroma gracefully', () => {
      const emptyChroma = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      
      const match = matchChordToChroma(emptyChroma, 'basic');
      
      expect(match.name).toBe('N/C');
      expect(match.confidence).toBe(0);
    });

    it('should improve accuracy with key prior', () => {
      // Ambiguous chord that could be C or Am
      const ambiguousChroma = [0.6, 0, 0, 0, 0.6, 0, 0, 0.4, 0, 0.5, 0, 0];
      
      const matchWithoutKey = matchChordToChroma(ambiguousChroma, 'basic');
      const matchWithCMajorKey = matchChordToChroma(ambiguousChroma, 'basic', 'C');
      
      // With C major key context, should prefer C over Am
      expect(matchWithCMajorKey.confidence).toBeGreaterThanOrEqual(matchWithoutKey.confidence);
    });
  });

  describe('Chord vocabulary accuracy', () => {
    it('should correctly identify intervals for known chords', () => {
      const cMajorIntervals = getChordIntervals('C');
      const cMinorIntervals = getChordIntervals('Cm');
      const c7Intervals = getChordIntervals('C7');
      
      expect(cMajorIntervals).toEqual([0, 4, 7]); // C, E, G
      expect(cMinorIntervals).toEqual([0, 3, 7]); // C, Eb, G
      expect(c7Intervals).toEqual([0, 4, 7, 10]); // C, E, G, Bb
    });

    it('should handle invalid chord names', () => {
      const invalidIntervals = getChordIntervals('InvalidChord');
      expect(invalidIntervals).toBeNull();
    });
  });
});