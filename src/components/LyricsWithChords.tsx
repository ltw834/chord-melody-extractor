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
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  return (
    <div className="mt-6 p-4 bg-card border rounded-lg">
      <h3 className="text-sm font-medium mb-2">Lyrics + Chords</h3>
      <div className="space-y-3 text-sm leading-6">
        {lyrics.map((l, i) => {
          const mid = (l.start + l.end) / 2;
          const chord = chordAtTime(chords, mid);
          return (
            <div key={i}>
              <div className="text-xs text-primary font-semibold mb-1">{chord}</div>
              <div>
                <span className="opacity-60 mr-2">[{fmt(l.start)}]</span>
                {l.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

