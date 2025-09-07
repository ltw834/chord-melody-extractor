import json
import os
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import numpy as np
import librosa
import librosa.display
import soundfile as sf

# Optional music21 for MusicXML export
try:
    import music21 as m21
    MUSIC21_AVAILABLE = True
except ImportError:
    MUSIC21_AVAILABLE = False

# Attempt to import MVP engine (both package-style and flat-style)
try:
    from src import chords_mvp as _cm  # type: ignore
    chords_mvp_analyze = _cm.analyze
except Exception:
    try:
        from chords_mvp import analyze as chords_mvp_analyze  # type: ignore
    except Exception:
        chords_mvp_analyze = None

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def estimate_tempo_beats(y: np.ndarray, sr: int) -> Tuple[float, List[float]]:
    """Extract tempo and beat positions using librosa."""
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=True)
    beats_sec = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    return float(tempo), beats_sec

def estimate_dynamics(y: np.ndarray, sr: int) -> List[Tuple[float, float]]:
    """Extract RMS envelope as dynamics information."""
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    rms_db = librosa.amplitude_to_db(rms, ref=np.max(rms))
    return list(zip(times.tolist(), rms_db.tolist()))

def estimate_melody_notes(y: np.ndarray, sr: int) -> List[Tuple[float, float, int]]:
    """Extract monophonic melody using pYIN algorithm."""
    try:
        # Use pYIN for fundamental frequency estimation
        f0, voiced_flag, _ = librosa.pyin(
            y, 
            fmin=librosa.note_to_hz('C2'), 
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            frame_length=2048
        )
        
        times = librosa.frames_to_time(np.arange(len(f0)), sr=sr)
        
        # Convert to MIDI notes and segment into note events
        notes = []
        current_start = None
        current_midi = None
        
        for i, (t, freq, voiced) in enumerate(zip(times, f0, voiced_flag)):
            if not voiced or np.isnan(freq):
                # End current note if any
                if current_midi is not None:
                    notes.append((float(current_start), float(t), int(round(current_midi))))
                    current_start = None
                    current_midi = None
                continue
            
            midi_note = librosa.hz_to_midi(freq)
            midi_rounded = int(round(midi_note))
            
            if current_midi is None:
                # Start new note
                current_start = t
                current_midi = midi_rounded
            elif abs(midi_rounded - current_midi) > 0.5:  # Significant pitch change
                # End current note and start new one
                notes.append((float(current_start), float(t), int(current_midi)))
                current_start = t
                current_midi = midi_rounded
        
        # End final note if any
        if current_midi is not None and len(times) > 0:
            notes.append((float(current_start), float(times[-1]), int(current_midi)))
        
        return notes
        
    except Exception as e:
        print(f"Melody extraction failed: {e}")
        return []

def estimate_chords_simple(y: np.ndarray, sr: int, beats: List[float]) -> List[Tuple[float, float, str]]:
    """Simple chord estimation using chroma features and beat synchronization."""
    if len(beats) < 2:
        return []
    
    # Compute chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    
    # Convert beats to frame indices
    beat_frames = librosa.time_to_frames(beats, sr=sr, hop_length=512)
    
    # Simple chord templates (root, third, fifth)
    chord_names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    major_template = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0])  # Major triad
    minor_template = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0])  # Minor triad
    
    def classify_chord(chroma_vector):
        """Classify a chroma vector as a chord."""
        if np.sum(chroma_vector) < 0.1:  # Very quiet
            return "N"  # No chord
        
        best_chord = ("N", -np.inf)
        
        for root in range(12):
            # Test major chord
            major_score = np.dot(chroma_vector, np.roll(major_template, root))
            if major_score > best_chord[1]:
                best_chord = (chord_names[root], major_score)
            
            # Test minor chord  
            minor_score = np.dot(chroma_vector, np.roll(minor_template, root))
            if minor_score > best_chord[1]:
                best_chord = (chord_names[root] + "m", minor_score)
        
        return best_chord[0]
    
    # Analyze each beat segment
    chord_sequence = []
    for i in range(len(beat_frames) - 1):
        start_frame = beat_frames[i]
        end_frame = beat_frames[i + 1]
        
        # Average chroma over this beat segment
        if end_frame > start_frame and end_frame <= chroma.shape[1]:
            segment_chroma = chroma[:, start_frame:end_frame].mean(axis=1)
            chord_label = classify_chord(segment_chroma)
            
            start_time = float(beats[i])
            end_time = float(beats[i + 1])
            chord_sequence.append((start_time, end_time, chord_label))
    
    return chord_sequence

def bars_from_beats_enhanced(beats: List[float], numerator: int) -> List[Tuple[int, float, float]]:
    """Convert beat list to bar timing information."""
    bars = []
    if not beats or numerator <= 0:
        return bars
    
    beats_per_bar = numerator
    for i in range(0, len(beats) - numerator, numerator):
        bar_number = i // numerator + 1
        start_time = beats[i]
        end_time = beats[i + numerator] if i + numerator < len(beats) else beats[-1] + 2.0
        bars.append((bar_number, start_time, end_time))
    
    return bars

def export_musicxml_melody(melody_notes: List[Tuple[float, float, int]], output_path: str = "outputs/melody.musicxml"):
    """Export melody to MusicXML format using music21."""
    if not MUSIC21_AVAILABLE:
        raise ImportError("music21 is required for MusicXML export. Install with: pip install music21")
    
    if not melody_notes:
        return
    
    # Create a music21 stream
    score = m21.stream.Score()
    part = m21.stream.Part()
    part.append(m21.clef.TrebleClef())
    
    for start_time, end_time, midi_note in melody_notes:
        # Convert duration to quarter notes (approximate)
        duration_seconds = end_time - start_time
        quarter_length = max(duration_seconds / 0.5, 0.25)  # Rough: 0.5s ≈ quarter note
        
        # Create note
        note = m21.note.Note(midi_note)
        note.duration.quarterLength = quarter_length
        part.append(note)
    
    score.append(part)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Write to file
    score.write('musicxml', fp=output_path)


def load_audio(path: str, sr: int = 22050, mono: bool = True):
    y, sr = librosa.load(path, sr=sr, mono=mono)
    return y, sr


def _collapse_labels(times: np.ndarray, labels: List[str]) -> List[Tuple[float, float, str]]:
    segments: List[Tuple[float, float, str]] = []
    if len(labels) == 0:
        return segments
    cur = labels[0]
    s = float(times[0])
    for i in range(1, len(labels)):
        if labels[i] != cur:
            segments.append((s, float(times[i]), cur))
            s = float(times[i])
            cur = labels[i]
    segments.append((s, float(times[-1] if len(times) > 1 else s + 0.1), cur))
    return segments


def estimate_key_from_chroma(chroma: np.ndarray) -> Tuple[int, str]:
    """Legacy function for backward compatibility."""
    # Krumhansl-Kessler profiles (normalized)
    maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minp = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    maj /= maj.sum(); minp /= minp.sum()
    pc = chroma.mean(axis=1)
    best = None
    for root in range(12):
        smaj = (np.roll(maj, root) @ pc, "major", root)
        smin = (np.roll(minp, root) @ pc, "minor", root)
        if best is None or smaj[0] > best[0]:
            best = smaj
        if smin[0] > best[0]:
            best = smin
    assert best is not None
    return int(best[2]), str(best[1])

def estimate_key(y: np.ndarray, sr: int) -> Dict[str, str]:
    """Enhanced key estimation using Krumhansl-Schmuckler algorithm."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Krumhansl-Kessler profiles (normalized)
    prof_maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    prof_min = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    prof_maj /= prof_maj.sum()
    prof_min /= prof_min.sum()
    
    chroma_mean = chroma.mean(axis=1)
    
    # Test all 24 keys (12 major + 12 minor)
    scores = []
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    
    for r in range(12):
        s_maj = np.dot(np.roll(prof_maj, r), chroma_mean)
        s_min = np.dot(np.roll(prof_min, r), chroma_mean)
        scores.append(("major", r, s_maj))
        scores.append(("minor", r, s_min))
    
    mode, root, _ = max(scores, key=lambda x: x[2])
    return {"tonic_name": names[root], "mode": mode}


def guess_time_signature(beats: List[float]) -> Dict[str, Any]:
    """Legacy function for backward compatibility."""
    # Simple default to 4/4 if unsure
    ts = {"numerator": 4, "denominator": 4, "confidence": 0.5}
    if len(beats) < 8:
        return ts
    # Try to detect periodic accent every N beats by variance minimization
    intervals = np.diff(beats)
    if len(intervals) == 0:
        return ts
    cand = []
    for n in (3, 4):
        # measure lengths by summing n consecutive beat intervals
        m = np.add.reduceat(intervals, np.arange(0, len(intervals), n))
        if len(m) > 1:
            cand.append((n, float(1.0 / (np.std(m) + 1e-6))))
    if cand:
        best_n, conf = max(cand, key=lambda x: x[1])
        ts = {"numerator": int(best_n), "denominator": 4, "confidence": float(min(conf / 10.0, 0.99))}
    return ts

def estimate_time_signature(beats: List[float]) -> Dict[str, int]:
    """Improved time signature estimation via beat grouping analysis."""
    if len(beats) < 8:
        return {"numerator": 4, "denominator": 4}
    
    # Analyze beat-to-beat intervals for periodicity
    intervals = np.diff(beats)
    if len(intervals) == 0:
        return {"numerator": 4, "denominator": 4}
    
    # Use autocorrelation to find periodicity
    mean_interval = intervals.mean()
    centered = intervals - mean_interval
    autocorr = np.correlate(centered, centered, mode="full")
    autocorr = autocorr[len(autocorr)//2:]
    
    # Test common time signatures
    candidates = [3, 4, 6, 8]
    scores = []
    
    for numerator in candidates:
        if numerator <= len(autocorr):
            # Look for peaks at multiples of the numerator
            indices = np.arange(numerator-1, min(len(autocorr), 8*numerator), numerator)
            if len(indices) > 0:
                score = autocorr[indices].mean()
                scores.append((numerator, score))
            else:
                scores.append((numerator, -1))
        else:
            scores.append((numerator, -1))
    
    # Pick the numerator with highest autocorrelation score
    best_numerator = max(scores, key=lambda x: x[1])[0]
    return {"numerator": int(best_numerator), "denominator": 4}


def _nearest(x: float, arr: List[float]) -> float:
    if not arr:
        return x
    idx = int(np.argmin(np.abs(np.array(arr) - x)))
    return float(arr[idx])


def quantize_chord_boundaries_to_beats(
    chords: List[Tuple[float, float, str]],
    beats: List[float],
    max_shift: float = 0.08,
    duration: float | None = None,
) -> List[Tuple[float, float, str]]:
    if not chords:
        return []
    beats_sorted = sorted(beats)
    if duration is None:
        duration = max([ch[1] for ch in chords] + beats_sorted + [0.0])
    out: List[Tuple[float, float, str]] = []
    last_end = 0.0
    for s, e, lab in chords:
        s2 = s
        e2 = e
        ns = _nearest(s, beats_sorted)
        ne = _nearest(e, beats_sorted)
        if abs(ns - s) <= max_shift:
            s2 = ns
        if abs(ne - e) <= max_shift:
            e2 = ne
        s2 = float(max(0.0, min(s2, duration)))
        e2 = float(max(0.0, min(e2, duration)))
        if e2 <= s2:
            e2 = min(s2 + 1e-3, duration)
        # ensure monotonic non-overlap
        s2 = max(s2, last_end)
        if e2 <= s2:
            e2 = min(s2 + 1e-3, duration)
        out.append((s2, e2, lab))
        last_end = e2
    return out


def _baseline_engine(path: str) -> Dict[str, Any]:
    y, sr = librosa.load(path, sr=22050, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    chords_raw: List[Tuple[float, float, str]] = []
    if len(beat_times) >= 2:
        for i in range(len(beat_times) - 1):
            # use the beat frame column if in range; else pick nearest
            cf = min(chroma.shape[1] - 1, max(0, int(np.round(librosa.time_to_frames([beat_times[i]], sr=sr)[0]))))
            root = roots[int(np.argmax(chroma[:, cf])) % 12]
            chords_raw.append((float(beat_times[i]), float(beat_times[i + 1]), f"{root}:Maj"))
    key = {"tonic_name": "", "mode": ""}
    return {"tempo": float(tempo), "beats": beat_times, "chords": chords_raw, "key": key,
            "melody_notes": [], "sections": {"segments": []}}


def analyze_audio(path: str) -> Dict[str, Any]:
    """Enhanced audio analysis with comprehensive music feature extraction."""
    print(f"Analyzing audio: {path}")
    
    # Load audio once for all analysis
    y, sr = librosa.load(path, sr=22050, mono=True)
    
    # Extract fundamental features using new functions
    tempo, beats = estimate_tempo_beats(y, sr)
    time_sig = estimate_time_signature(beats)
    key = estimate_key(y, sr)
    
    # Extract musical content
    chords_raw = estimate_chords_simple(y, sr, beats)
    melody_notes = estimate_melody_notes(y, sr)
    dynamics = estimate_dynamics(y, sr)
    
    # Calculate bars from beats and time signature
    bars = bars_from_beats_enhanced(beats, time_sig["numerator"])
    
    # Try MVP engine as fallback for better chord detection
    engine_res = None
    if chords_mvp_analyze is not None:
        try:
            engine_res = chords_mvp_analyze(path)
            # Use MVP chords if available and better
            if engine_res and "chords" in engine_res and len(engine_res["chords"]) > len(chords_raw):
                mvp_chords = [(float(s), float(e), str(l)) for (s, e, l) in engine_res["chords"]]
                chords_raw = mvp_chords
                print(f"Using MVP chords: {len(mvp_chords)} chords")
        except Exception as e:
            print(f"MVP engine failed: {e}")
    
    # Quantize chord boundaries to beats for better alignment
    duration = max([beats[-1] if beats else 0.0] + [end for _, end, _ in chords_raw])
    chords_snapped = quantize_chord_boundaries_to_beats(chords_raw, beats, max_shift=0.08, duration=duration)
    
    # Use MVP sections if available
    sections = {"segments": []}
    if engine_res and "sections" in engine_res:
        sections = engine_res["sections"]
    
    # Use MVP melody if better
    if engine_res and "melody_notes" in engine_res and len(engine_res["melody_notes"]) > len(melody_notes):
        melody_notes = engine_res["melody_notes"]
        print(f"Using MVP melody: {len(melody_notes)} notes")
    
    result = {
        "tempo": float(tempo),
        "beats": beats,
        "time_signature": time_sig,
        "key": key,
        "chords_raw": chords_raw,
        "chords": chords_snapped,
        "melody_notes": melody_notes,
        "dynamics": dynamics,
        "sections": sections,
        "bars": bars,
        "beats_per_bar": time_sig["numerator"],
        "duration": float(duration)
    }
    
    # Comprehensive diagnostics
    result["_diagnostics"] = {
        "beats_count": len(beats),
        "bars_count": len(bars),
        "chords_raw_count": len(chords_raw),
        "chords_snapped_count": len(chords_snapped),
        "melody_notes_count": len(melody_notes),
        "dynamics_count": len(dynamics),
        "first_beat": beats[0] if beats else None,
        "first_chord": chords_snapped[0] if chords_snapped else None,
        "key_detected": f"{key['tonic_name']} {key['mode']}",
        "time_signature": f"{time_sig['numerator']}/{time_sig['denominator']}",
        "duration": duration
    }
    
    print(f"Analysis complete: {len(chords_snapped)} chords, {len(melody_notes)} notes, {len(bars)} bars, key: {key['tonic_name']} {key['mode']}")
    return result


def export_practice_audio(in_path: str, out_path: str, rate: float = 0.85):
    try:
        import pyrubberband as prb
        y, sr = load_audio(in_path)
        y2 = prb.time_stretch(y, sr, rate)
    except Exception:
        y, sr = load_audio(in_path)
        y2 = librosa.effects.time_stretch(y, rate)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_path, y2, sr)


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("audio")
    p.add_argument("--practice-rate", type=float, default=0.85)
    args = p.parse_args()
    res = analyze_audio(args.audio)
    Path("outputs").mkdir(exist_ok=True)
    Path("outputs/analysis.json").write_text(json.dumps(res, indent=2))
    export_practice_audio(args.audio, "outputs/practice.wav", rate=args.practice_rate)
    print("Wrote outputs/analysis.json and outputs/practice.wav")
