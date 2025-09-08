"use client";
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { timeToBarBeat } from '@/lib/audio';

export default function BigCounter() {
  const { currentTime, beatInfo, duration } = useAppStore(state => ({ currentTime: state.currentTime, beatInfo: state.beatInfo, duration: state.duration }));
  const [display, setDisplay] = useState({ bar: 1, beat: 1, time: '0:00' });

  useEffect(() => {
    if (!beatInfo) return setDisplay({ bar: 1, beat: 1, time: fmt(currentTime) });
    try {
      const { bar, beat } = timeToBarBeat(currentTime, beatInfo);
      setDisplay({ bar, beat, time: fmt(currentTime) });
    } catch {
      setDisplay({ bar: 1, beat: 1, time: fmt(currentTime) });
    }
  }, [currentTime, beatInfo]);

  return (
    <div className="flex items-center gap-3 text-2xl sm:text-3xl font-semibold">
      <span className="tabular-nums">{display.bar}:{display.beat}</span>
      <span className="text-neutral-500 text-lg">({display.time}/{fmt(duration)})</span>
    </div>
  );
}

function fmt(t: number) {
  if (!t || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
