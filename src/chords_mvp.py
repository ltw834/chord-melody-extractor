from __future__ import annotations
import librosa
import numpy as np

ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']


def _root_from_chroma_vec(v: np.ndarray) -> str:
    v = np.asarray(v).ravel()
    idx = int(np.argmax(v))
    return ROOTS[idx % 12]


def analyze(path: str) -> dict:
    """Lightweight, fast baseline returning seconds-based beats and chords.
    The UI/main will normalize and snap boundaries.
    """
    # 1) load mono @ 22.05k for speed
    y, sr = librosa.load(path, sr=22050, mono=True)
    # 2) tempo + beats (times in seconds)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    # 3) chroma on CQT (robust for harmony)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    # 4) chord per beat: label by chroma peak (root only, "Maj" placeholder)
    chords = []
    if len(beat_times) >= 2:
        for i in range(len(beat_times) - 1):
            cf = min(chroma.shape[1] - 1, max(0, beat_frames[i]))
            root = _root_from_chroma_vec(chroma[:, cf])
            chords.append((float(beat_times[i]), float(beat_times[i + 1]), f"{root}:Maj"))
    # Minimal schema; main.analyze_audio will enrich
    return {
        "tempo": float(tempo),
        "beats": beat_times.tolist(),
        "chords": chords,
        "melody_notes": [],
        "sections": {"segments": []},
        "key": {"tonic_name": "", "mode": ""},
    }
