import { TimelineSegment } from '@/components/Timeline';
import { WhisperSegment } from '@/components/LyricsPanel';

function chordAtTime(segments: TimelineSegment[], t: number) {
  const seg = segments.find(s => t >= s.startTime && t < s.endTime);
  return seg ? seg.chord : 'N/C';
}

export function LyricsWithChords({
  lyrics,
  chords
}: {
  lyrics: WhisperSegment[];
  chords: TimelineSegment[];
}) {
  if (!lyrics?.length) return null;

  // helper to format time
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // For each lyric segment, split into words and place chord labels above words
  // by finding which chord segment covers the word's midpoint.
  return (
    <div className="mt-6 p-4 bg-card border rounded-lg">
      <h3 className="text-sm font-medium mb-2">Lyrics + Chords</h3>

      <div className="space-y-4 text-sm leading-6">
        {lyrics.map((line, idx) => {
          // If the segment contains word-level timestamps, use them for exact alignment.
          // Otherwise fall back to splitting and distributing times across the segment.
          let tokens: string[] = [];
          let wordTimes: number[] = [];

          if (line.words && line.words.length > 0) {
            // use words provided by transcription (preserve spaces between tokens)
            for (const w of line.words) {
              tokens.push(w.text);
              wordTimes.push(w.start + (w.end - w.start) / 2);
            }
          } else {
            tokens = line.text.split(/(\s+)/).filter(Boolean);
            const span = Math.max(0.001, line.end - line.start);
            let acc = 0;
            wordTimes = tokens.map(() => {
              const t = line.start + (acc + 0.5) / tokens.length * span;
              acc += 1;
              return t;
            });
          }

          return (
            <div key={idx} className="flex flex-col">
              {/* chord row */}
              <div className="flex flex-wrap items-end gap-2 mb-1">
                {tokens.map((token, wi) => {
                  const t = wordTimes[wi];
                  const chord = chordAtTime(chords, t);
                  // hide N/C chords
                  if (!chord || chord === 'N/C') return (
                    <span key={wi} className="w-auto text-xs opacity-0 select-none">&nbsp;</span>
                  );
                  return (
                    <span key={wi} className="text-xs text-primary font-semibold">
                      {chord}
                    </span>
                  );
                })}
              </div>

              {/* lyric row - words keep same wrapping as chord row */}
              <div className="flex flex-wrap gap-2">
                {tokens.map((tkn, wi) => (
                  <span key={wi} className="text-sm">
                    {tkn}
                  </span>
                ))}
              </div>

              {/* time label */}
              <div className="text-xs text-muted-foreground mt-1">[{fmt(line.start)}]</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

