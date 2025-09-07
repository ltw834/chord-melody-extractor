import { TimelineSegment } from '@/components/Timeline';

// Minimal MIDI writer for a single track chord guide
export function exportSegmentsToMidi(segments: TimelineSegment[], bpm = 120): Blob {
  // Helper to write variable-length quantity
  const vlq = (value: number) => {
    const bytes = [] as number[];
    let buffer = value & 0x7F;
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
      bytes.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8; else break;
    }
    return bytes;
  };

  const header = new Uint8Array([
    0x4d,0x54,0x68,0x64, // MThd
    0x00,0x00,0x00,0x06, // header length
    0x00,0x01,           // format 1
    0x00,0x01,           // one track
    0x01,0xE0            // 480 TPQN
  ]);

  // Tempo meta event
  const mpqn = Math.round(60000000 / bpm);
  const tempoEvent = [0x00, 0xFF, 0x51, 0x03, (mpqn>>16)&0xFF, (mpqn>>8)&0xFF, mpqn&0xFF];

  // Convert chord names to MIDI pitches (root triads)
  const noteForName = (name: string) => {
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const m = name.match(/^[A-G](#|b)?/);
    if (!m) return null;
    let idx = notes.indexOf(m[0].replace('b', '#'));
    if (idx < 0) return null;
    const minor = /m(?!aj)/.test(name);
    const intervals = minor ? [0,3,7] : [0,4,7];
    return intervals.map(semi => 60 + ((idx + semi) % 12)); // around middle C
  };

  const events: number[] = [];
  events.push(...tempoEvent);

  const tpq = 480;
  let lastTick = 0;
  segments.forEach(seg => {
    const startTick = Math.round(seg.startTime * (tpq * (bpm/60)));
    const endTick = Math.round(seg.endTime * (tpq * (bpm/60)));
    const deltaStart = startTick - lastTick;
    lastTick = startTick;
    const notes = noteForName(seg.chord);
    if (!notes) return;
    // Note on for triad
    events.push(...vlq(deltaStart));
    notes.forEach(n => {
      events.push(0x90, n, 90);
      // subsequent notes require 0 delta
      if (n !== notes[0]) events.splice(events.length-3,0,0x00);
    });
    // Note off at end
    const deltaEnd = Math.max(1, endTick - lastTick);
    lastTick = endTick;
    events.push(...vlq(deltaEnd));
    notes.forEach(n => {
      events.push(0x80, n, 0x40);
      if (n !== notes[0]) events.splice(events.length-3,0,0x00);
    });
  });

  // End of track
  events.push(0x00, 0xFF, 0x2F, 0x00);

  // Build track chunk
  const trackData = new Uint8Array(events);
  const length = trackData.length;
  const trackHeader = new Uint8Array([
    0x4d,0x54,0x72,0x6b,
    (length>>24)&0xFF, (length>>16)&0xFF, (length>>8)&0xFF, length&0xFF
  ]);

  const file = new Uint8Array(header.length + trackHeader.length + trackData.length);
  file.set(header, 0);
  file.set(trackHeader, header.length);
  file.set(trackData, header.length + trackHeader.length);
  return new Blob([file], { type: 'audio/midi' });
}

