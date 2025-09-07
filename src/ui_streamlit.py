import json
import os
from pathlib import Path
import streamlit as st
from typing import Optional, List, Tuple, Dict, Any
import time
from datetime import datetime

# MoviePy (video -> audio)
try:
    from moviepy.editor import VideoFileClip
except Exception:
    VideoFileClip = None

from main import analyze_audio, export_practice_audio, export_musicxml_melody

# Page config
st.set_page_config(
    page_title="Chord & Melody Extractor",
    page_icon="🎹",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Load CSS theme
def load_css():
    css_path = Path(__file__).parent / "ui_theme.css"
    if css_path.exists():
        with open(css_path) as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    else:
        # Inline CSS for the clean viewport design
        st.markdown("""
        <style>
        .stApp > div:first-child { padding-top: 0 !important; }
        section[data-testid="stSidebar"] { display: none !important; }
        .main > div { padding-top: 0 !important; padding-bottom: 100px; }
        div[data-testid="stStatusWidget"] { display: none !important; }
        body { background: #0F0F23; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        
        /* Info chips */
        .info-chips {
            display: flex;
            gap: 16px;
            margin: 16px 0;
            flex-wrap: wrap;
        }
        
        .info-chip {
            background: linear-gradient(135deg, #6C63FF, #8B7FFF);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9rem;
            box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
        }
        
        /* Transport bar */
        .transport-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(45, 47, 74, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1px solid #374151;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            gap: 24px;
            z-index: 1000;
        }
        
        .transport-controls {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .transport-button {
            background: #6C63FF;
            border: none;
            border-radius: 8px;
            width: 40px;
            height: 40px;
            color: white;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .transport-button:hover {
            background: #8B7FFF;
            transform: scale(1.05);
        }
        
        .transport-button.secondary {
            background: #374151;
        }
        
        .transport-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 16px;
            font-family: monospace;
            font-size: 14px;
            color: #B4B7C7;
        }
        
        .loop-info {
            color: #F59E0B;
            font-weight: 600;
        }
        </style>
        """, unsafe_allow_html=True)

load_css()

# Constants
DATA_DIR = Path("data")
OUT_DIR = Path("outputs")
DATA_DIR.mkdir(exist_ok=True)
OUT_DIR.mkdir(exist_ok=True)

BUILD_TIME = datetime.now().strftime("%Y-%m-%d %H:%M")

# Initialize session state
def init_session_state():
    defaults = {
        "playhead": 0.0,
        "is_playing": False,
        "play_start_time": None,
        "sync": True,
        "speed": 1.0,
        "loop_start": 1,
        "loop_end": 4,
        "analysis": None,
        "audio_path": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

@st.cache_data(show_spinner=False)
def load_analysis(audio_path: str, mtime: float):
    """Cache analysis by (path, mtime)"""
    return analyze_audio(audio_path)

def save_and_extract_audio(upload) -> Path:
    raw = DATA_DIR / upload.name
    raw.write_bytes(upload.getbuffer())
    ext = raw.suffix.lower()
    
    # Always convert to WAV for web compatibility
    wav = raw.with_suffix(".wav")
    
    if ext in {".mp4", ".mov", ".m4a"}:
        if VideoFileClip is None:
            st.error("🎬 Video files need MoviePy: `pip install moviepy`")
            st.stop()
        
        try:
            with st.spinner("🎬 Extracting audio..."):
                clip = VideoFileClip(str(raw))
                clip.audio.write_audiofile(str(wav), verbose=False, logger=None)
                clip.close()
            return wav
        except Exception as e:
            st.error(f"Video extraction failed: {e}")
            st.stop()
    
    elif ext in {".mp3", ".m4a", ".flac", ".ogg"}:
        try:
            with st.spinner("🔄 Converting to WAV..."):
                import librosa
                import soundfile as sf
                y, sr = librosa.load(str(raw), sr=None)
                sf.write(str(wav), y, sr)
            return wav
        except Exception as e:
            st.error(f"Audio conversion failed: {e}")
            st.stop()
    
    return raw if ext == ".wav" else wav

def render_viewport(chords, melody_notes, beats, bars, dynamics, playhead_s, width_px=1800, height_px=200):
    """Clean viewport renderer with timeline lanes exactly as sketched"""
    if not beats:
        st.write("No timeline data available")
        return
    
    total_duration = beats[-1] if beats else max([e for _, e, _ in chords], default=60.0)
    if total_duration <= 0:
        total_duration = 60.0
    
    def time_to_px(t):
        return max(2, int(t / total_duration * width_px))
    
    # Create the viewport HTML
    html_parts = []
    
    # Container
    html_parts.append(f'''
    <div style="
        position: relative;
        width: {width_px}px;
        height: {height_px}px;
        background: linear-gradient(180deg, rgba(30, 31, 63, 0.8), rgba(37, 38, 71, 0.6));
        border: 1px solid rgba(108, 99, 255, 0.2);
        border-radius: 12px;
        padding: 16px;
        margin: 16px 0;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    ">
    ''')
    
    # Beat ruler (top lane)
    html_parts.append('''
    <div style="position: relative; height: 20px; margin-bottom: 8px;">
        <div style="color: #B4B7C7; font-size: 11px; font-weight: 600; margin-bottom: 4px;">BEATS & BARS</div>
    ''')
    
    last_time = 0.0
    for i, beat_time in enumerate(beats[:100]):  # Limit for performance
        beat_width = time_to_px(beat_time - last_time)
        is_bar = any(beat_time >= bar_start and beat_time < bar_start + 0.1 for _, bar_start, _ in bars)
        
        border_style = "2px solid rgba(108, 99, 255, 0.8)" if is_bar else "1px solid rgba(255, 255, 255, 0.1)"
        html_parts.append(f'''
        <div style="
            display: inline-block;
            width: {beat_width}px;
            height: 16px;
            border-right: {border_style};
            box-sizing: border-box;
        "></div>
        ''')
        last_time = beat_time
    
    html_parts.append('</div>')
    
    # Chord lane (middle)
    html_parts.append('''
    <div style="height: 50px; display: flex; align-items: center; gap: 4px; margin: 8px 0;">
        <div style="color: #B4B7C7; font-size: 11px; font-weight: 600; position: absolute; left: -60px;">CHORDS</div>
    ''')
    
    for start_time, end_time, chord_label in chords[:50]:  # Limit for performance
        chord_width = time_to_px(end_time - start_time)
        if chord_width < 2:
            continue
            
        # Color coding for chord types
        if chord_label == "N":
            color = "#6B7280"
        elif "m" in chord_label.lower():
            color = "#A78BFA"  # Purple for minor
        elif "7" in chord_label:
            color = "#F59E0B"  # Orange for 7ths
        else:
            color = "#7DD3FC"  # Blue for major
        
        html_parts.append(f'''
        <div style="
            height: 40px;
            width: {chord_width}px;
            background: {color};
            color: #0E0F13;
            font-weight: 800;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            margin-right: 2px;
        " title="{chord_label} ({start_time:.1f}s-{end_time:.1f}s)">
            {chord_label}
        </div>
        ''')
    
    html_parts.append('</div>')
    
    # Melody lane (bottom)
    html_parts.append('''
    <div style="position: relative; height: 80px; margin-top: 8px; border-top: 1px solid rgba(108, 99, 255, 0.2);">
        <div style="color: #B4B7C7; font-size: 11px; font-weight: 600; margin: 4px 0; position: absolute; left: -60px;">MELODY</div>
    ''')
    
    if melody_notes:
        # Simple MIDI note range calculation
        midi_notes = [midi for _, _, midi in melody_notes]
        min_midi = min(midi_notes) if midi_notes else 48
        max_midi = max(midi_notes) if midi_notes else 84
        midi_range = max(max_midi - min_midi, 12)
        
        for start_time, end_time, midi_note in melody_notes[:200]:  # Limit for performance
            note_width = max(time_to_px(end_time - start_time), 2)
            note_x = time_to_px(start_time)
            
            # Map MIDI note to vertical position (inverted so higher notes are higher)
            note_y = 70 - int(((midi_note - min_midi) / midi_range) * 60)
            
            html_parts.append(f'''
            <div style="
                position: absolute;
                left: {note_x}px;
                top: {note_y}px;
                width: {note_width}px;
                height: 4px;
                background: #6C63FF;
                border-radius: 2px;
                box-shadow: 0 0 4px rgba(108, 99, 255, 0.6);
            " title="MIDI {midi_note} ({start_time:.1f}s-{end_time:.1f}s)"></div>
            ''')
    
    html_parts.append('</div>')
    
    # Dynamics lane (optional thin waveform)
    if dynamics:
        html_parts.append('''
        <div style="position: relative; height: 20px; margin-top: 4px; border-top: 1px solid rgba(108, 99, 255, 0.1);">
            <div style="color: #B4B7C7; font-size: 10px; font-weight: 600; margin-bottom: 2px; position: absolute; left: -60px;">DYNAMICS</div>
        ''')
        
        # Sample dynamics points for visualization
        for i, (time_point, rms_db) in enumerate(dynamics[::10]):  # Sample every 10th point
            if i >= 100:  # Limit points
                break
            x_pos = time_to_px(time_point)
            # Map RMS dB to height (typically -60 to 0 dB)
            height = max(1, int(((rms_db + 60) / 60) * 16))
            
            html_parts.append(f'''
            <div style="
                position: absolute;
                left: {x_pos}px;
                bottom: 0px;
                width: 2px;
                height: {height}px;
                background: rgba(108, 99, 255, 0.4);
            "></div>
            ''')
        
        html_parts.append('</div>')
    
    # Playhead
    playhead_x = time_to_px(playhead_s)
    html_parts.append(f'''
    <div style="
        position: absolute;
        left: {playhead_x}px;
        top: 16px;
        bottom: 16px;
        width: 2px;
        background: #6C63FF;
        box-shadow: 0 0 12px rgba(108, 99, 255, 0.8);
        z-index: 10;
    ">
        <div style="
            position: absolute;
            top: -4px;
            left: -3px;
            width: 8px;
            height: 8px;
            background: #6C63FF;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(108, 99, 255, 1);
        "></div>
    </div>
    ''')
    
    # Close container
    html_parts.append('</div>')
    
    # Render the complete viewport
    st.markdown(''.join(html_parts), unsafe_allow_html=True)

# Main UI
st.markdown(f"""
<div style="text-align: center; margin: 20px 0;">
    <h1 style="color: #6C63FF; margin: 0; font-size: 2.5rem; font-weight: 800;">
        🎹 Chord & Melody Extractor
    </h1>
    <p style="color: #B4B7C7; margin: 8px 0 0 0; font-size: 1.1rem;">Timeline-Centric Music Analysis</p>
    <div style="color: #9CA3AF; font-size: 0.8rem; margin-top: 4px;">Build: {BUILD_TIME}</div>
</div>
""", unsafe_allow_html=True)

# Upload section
uploaded = st.file_uploader(
    "🎵 Choose an audio file to analyze", 
    type=["mp3", "wav", "mp4", "mov", "m4a"],
    help="Upload MP3, WAV, or video files for chord and melody analysis"
)

if uploaded:
    # Process audio
    st.session_state.audio_path = save_and_extract_audio(uploaded)
    
    # Show audio player
    st.audio(str(st.session_state.audio_path))
    
    # Auto-analyze
    with st.spinner("🔍 Analyzing audio..."):
        try:
            mtime = os.path.getmtime(str(st.session_state.audio_path))
        except:
            mtime = time.time()
        st.session_state.analysis = load_analysis(str(st.session_state.audio_path), float(mtime))
    
    if st.session_state.analysis:
        analysis = st.session_state.analysis
        
        # Info chips (exactly like your sketch)
        key_info = analysis.get("key", {"tonic_name": "C", "mode": "major"})
        tempo = analysis.get("tempo", 120)
        time_sig = analysis.get("time_signature", {"numerator": 4, "denominator": 4})
        bars_count = len(analysis.get("bars", []))
        
        st.markdown(f"""
        <div class="info-chips">
            <div class="info-chip">🎵 Key: {key_info['tonic_name']} {key_info['mode']}</div>
            <div class="info-chip">🥁 Tempo: {tempo:.0f} BPM</div>
            <div class="info-chip">📏 Time Sig: {time_sig['numerator']}/{time_sig['denominator']}</div>
            <div class="info-chip">📊 Bars: {bars_count}</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Update playhead if playing
        if st.session_state.is_playing and st.session_state.play_start_time and st.session_state.sync:
            elapsed = time.time() - st.session_state.play_start_time
            st.session_state.playhead = elapsed * st.session_state.speed
            # Simple loop logic
            total_duration = analysis.get("duration", 60.0)
            if st.session_state.playhead >= total_duration:
                st.session_state.playhead = 0.0
                st.session_state.play_start_time = time.time()
        
        # Clean viewport (the main event!)
        render_viewport(
            chords=analysis.get("chords", []),
            melody_notes=analysis.get("melody_notes", []),
            beats=analysis.get("beats", []),
            bars=analysis.get("bars", []),
            dynamics=analysis.get("dynamics", []),
            playhead_s=st.session_state.playhead
        )
        
        # Controls below viewport
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            if st.button("📊 Export MusicXML", use_container_width=True):
                try:
                    melody_notes = analysis.get("melody_notes", [])
                    if melody_notes:
                        export_musicxml_melody(melody_notes, "outputs/melody.musicxml")
                        st.success("✅ Exported melody.musicxml")
                    else:
                        st.warning("No melody notes found")
                except Exception as e:
                    st.error(f"Export failed: {e}")
        
        with col2:
            if st.button("📄 Download JSON", use_container_width=True):
                json_data = json.dumps(analysis, indent=2)
                st.download_button(
                    "⬇️ Download Analysis", 
                    json_data, 
                    f"analysis_{int(time.time())}.json", 
                    "application/json"
                )
        
        with col3:
            st.session_state.speed = st.slider("Speed", 0.5, 1.5, st.session_state.speed, 0.1)
        
        with col4:
            # Loop controls
            bars = analysis.get("bars", [])
            max_bars = len(bars) if bars else 8
            loop_col1, loop_col2 = st.columns(2)
            with loop_col1:
                st.session_state.loop_start = st.number_input("Loop Start", 1, max_bars, st.session_state.loop_start)
            with loop_col2:
                st.session_state.loop_end = st.number_input("Loop End", st.session_state.loop_start, max_bars, st.session_state.loop_end)

# Fixed Transport Bar (always visible)
if st.session_state.analysis:
    duration = st.session_state.analysis.get("duration", 60.0)
    progress = (st.session_state.playhead / duration * 100) if duration > 0 else 0
    
    # Transport controls
    transport_html = f"""
    <div class="transport-bar">
        <div class="transport-controls">
            <button class="transport-button" onclick="window.parent.postMessage({{type: 'play_pause'}}, '*')">
                {'⏸️' if st.session_state.is_playing else '▶️'}
            </button>
            <button class="transport-button secondary" onclick="window.parent.postMessage({{type: 'stop'}}, '*')">⏹️</button>
        </div>
        <div class="transport-info">
            <span>{st.session_state.playhead:.1f}s / {duration:.1f}s</span>
            <div style="flex: 1; height: 4px; background: #374151; border-radius: 2px; margin: 0 16px; overflow: hidden;">
                <div style="height: 100%; background: linear-gradient(90deg, #6C63FF, #8B7FFF); width: {progress}%; border-radius: 2px; transition: width 0.1s;"></div>
            </div>
            <span class="loop-info">Loop: {st.session_state.loop_start}-{st.session_state.loop_end}</span>
        </div>
        <div class="transport-controls">
            <button class="transport-button secondary" title="Sync">🔄</button>
        </div>
    </div>
    """
    
    st.markdown(transport_html, unsafe_allow_html=True)

# Simple transport controls (until JS component is ready)
if st.session_state.analysis:
    col1, col2, col3 = st.columns([1, 3, 1])
    
    with col1:
        if st.button("⏸️ Pause" if st.session_state.is_playing else "▶️ Play", use_container_width=True):
            if st.session_state.is_playing:
                st.session_state.is_playing = False
                st.session_state.play_start_time = None
            else:
                st.session_state.is_playing = True
                st.session_state.play_start_time = time.time()
            st.rerun()
    
    with col2:
        # Position slider
        duration = st.session_state.analysis.get("duration", 60.0)
        new_position = st.slider(
            "Position", 
            0.0, 
            duration, 
            st.session_state.playhead, 
            0.1,
            label_visibility="collapsed"
        )
        if abs(new_position - st.session_state.playhead) > 0.5:  # Only update if significant change
            st.session_state.playhead = new_position
            if st.session_state.is_playing:
                st.session_state.play_start_time = time.time()
    
    with col3:
        if st.button("⏹️ Stop", use_container_width=True):
            st.session_state.is_playing = False
            st.session_state.playhead = 0.0
            st.session_state.play_start_time = None
            st.rerun()

# Auto-refresh when playing
if st.session_state.is_playing:
    time.sleep(0.2)  # Smooth updates
    st.rerun()