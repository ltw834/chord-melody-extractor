"use client";
import { useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';

export default function MeasureGrid() {
  // read store values via a single selector
  const { chordBlocks, beatInfo, currentTime, duration, gridSettings } = useAppStore(state => ({ chordBlocks: state.chordBlocks, beatInfo: state.beatInfo, currentTime: state.currentTime, duration: state.duration, gridSettings: state.gridSettings }));

  // Hooks must be called in the same order every render.
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const pxPerBeat = 28;

  // Safe computed values (guarded if beatInfo is null)
  const beatSec = beatInfo ? 60 / beatInfo.bpm * (4 / beatInfo.timeSignature.denominator) : 0.5;
  const totalBeats = beatInfo ? Math.ceil(duration / beatSec) : 0;
  const bars = beatInfo ? Math.ceil(totalBeats / beatInfo.timeSignature.numerator) : 0;

  const playheadLeft = beatSec > 0 ? (currentTime / beatSec) * pxPerBeat : 0;

  useEffect(() => {
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${playheadLeft}px)`;
  }, [playheadLeft]);

  // Build blocks arranged into rows
  const blocksByRow = useMemo(() => {
    const rows: Record<number, JSX.Element[]> = {};
    if (!chordBlocks || chordBlocks.length === 0) return rows;
    const barsPerRow = gridSettings?.barsPerRow || 5;
    for (let i = 0; i < chordBlocks.length; i++) {
      const b = chordBlocks[i];
      const tsig = beatInfo!.timeSignature;
      const startBar = Math.floor(b.startBeat / tsig.numerator);
      const rowIndex = Math.floor(startBar / barsPerRow);
      const left = (b.startBeat % (barsPerRow * tsig.numerator)) * pxPerBeat;
      const width = Math.max(1, (b.endBeat - b.startBeat)) * pxPerBeat;
      const isActive = currentTime >= b.startSec && currentTime < b.endSec;
      const el = (
        <div
          key={`${rowIndex}-${i}`}
          className={`absolute top-0 h-8 rounded-md border border-neutral-300/60 bg-emerald-100/70 overflow-hidden ${isActive ? 'ring-2 ring-emerald-400' : ''}`}
          style={{ left, width }}
          title={`${b.label} (${b.confidence ? Math.round(b.confidence * 100) : ''}%)`}
        >
          <div className="px-2 text-sm leading-8 font-medium text-neutral-800">{b.label}</div>
        </div>
      );
      rows[rowIndex] = rows[rowIndex] || [];
      rows[rowIndex].push(el);
    }
    return rows;
  }, [chordBlocks, currentTime, gridSettings, beatInfo]);

  const gridLines = useMemo(() => {
    const lines = [] as JSX.Element[];
    if (!beatInfo) return lines;
    for (let i = 0; i <= bars * beatInfo!.timeSignature.numerator; i++) {
      const x = i * pxPerBeat;
      const isBar = i % beatInfo!.timeSignature.numerator === 0;
      lines.push(
        <div
          key={i}
          className={isBar ? 'absolute top-0 bottom-0 border-l-2 border-neutral-400/70' : 'absolute top-0 bottom-0 border-l border-neutral-300/50'}
          style={{ left: x }}
        />
      );
    }
    return lines;
  }, [bars, beatInfo]);

  const barLabels = useMemo(() => {
    const labels = [] as JSX.Element[];
    if (!beatInfo) return labels;
    for (let b = 0; b < bars; b++) {
      const x = b * beatInfo!.timeSignature.numerator * pxPerBeat;
      labels.push(
        <div key={b} className="absolute -top-6 text-xs text-neutral-500" style={{ left: x }}>
          Bar {b + 1}
        </div>
      );
    }
    return labels;
  }, [bars, beatInfo]);

  const totalWidth = beatInfo ? bars * beatInfo.timeSignature.numerator * pxPerBeat : 0;

  if (!beatInfo) return null;

  const barsPerRow = gridSettings?.barsPerRow || 5;
  const totalRows = Math.max(1, Math.ceil(bars / barsPerRow));
  const rowWidth = barsPerRow * beatInfo!.timeSignature.numerator * pxPerBeat;

  return (
    <div className="relative mt-4 space-y-4">
      {Array.from({ length: totalRows }).map((_, rowIdx) => {
        const rowLeft = 0;
        const rowGridLines = [] as JSX.Element[];
        for (let i = 0; i <= barsPerRow * beatInfo!.timeSignature.numerator; i++) {
          const x = i * pxPerBeat;
          const isBar = i % beatInfo!.timeSignature.numerator === 0;
          rowGridLines.push(
            <div
              key={`line-${rowIdx}-${i}`}
              className={isBar ? 'absolute top-0 bottom-0 border-l-2 border-neutral-400/70' : 'absolute top-0 bottom-0 border-l border-neutral-300/50'}
              style={{ left: x }}
            />
          );
        }

        // Playhead visibility for this row
        const beatSecLocal = beatSec;
        const globalBeat = beatSecLocal > 0 ? currentTime / beatSecLocal : 0;
  const currentBar = Math.floor(globalBeat / beatInfo!.timeSignature.numerator);
        const currentRow = Math.floor(currentBar / barsPerRow);

        return (
          <div key={`row-${rowIdx}`}>
            <div className="relative border rounded-lg bg-white/70 overflow-x-auto">
              <div className="relative h-8" style={{ width: rowWidth }}>
                {rowGridLines}
                {/* blocks for this row */}
                {blocksByRow[rowIdx]}
                {/* playhead only visible in active row */}
                {currentRow === rowIdx && (
                  <div ref={playheadRef} className="absolute top-[-6px] h-[28px] w-[2px] bg-rose-500 shadow-[0_0_0_1px_rgba(255,0,0,.3)]" style={{ transform: `translateX(${playheadLeft}px)` }} />
                )}
              </div>
            </div>
            <div className="relative h-4" style={{ width: rowWidth }}>
              <div className="absolute -top-6 text-xs text-neutral-500">Rows {rowIdx * barsPerRow + 1}–{Math.min((rowIdx + 1) * barsPerRow, bars)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
