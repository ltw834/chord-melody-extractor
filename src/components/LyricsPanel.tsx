export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export function LyricsPanel({ segments }: { segments: WhisperSegment[] }) {
  if (!segments?.length) return null;
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  return (
    <div className="mt-6 p-4 bg-card border rounded-lg">
      <h3 className="text-sm font-medium mb-2">Lyrics</h3>
      <div className="space-y-1 text-sm leading-6">
        {segments.map((s, i) => (
          <div key={i}>
            <span className="opacity-60 mr-2">[{fmt(s.start)}]</span>
            {s.text}
          </div>
        ))}
      </div>
    </div>
  );
}

