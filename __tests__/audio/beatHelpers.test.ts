import { timeToBarBeat, quantizeSegmentsToBeats } from '@/lib/audio/';

describe('beat helpers', () => {
  test('timeToBarBeat 4/4 @120', () => {
    const info: any = { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } };
    const res = timeToBarBeat(0, info);
    expect(res.bar).toBe(1);
    expect(res.beat).toBe(1);
    const oneBeat = 60 / 120;
    const r2 = timeToBarBeat(oneBeat * 3.1, info);
    expect(r2.bar).toBe(1);
    expect(r2.beat).toBe(4);
  });

  test('quantize segments simple', () => {
    const info: any = { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } };
    const segments = [
      { start: 0.05, end: 0.9, label: 'C', confidence: 0.8 },
      { start: 0.95, end: 2.1, label: 'G', confidence: 0.9 }
    ];
    const blocks = quantizeSegmentsToBeats(segments, info, 'beat');
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].label).toBe('C');
  });
});
