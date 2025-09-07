import json
import os
from pathlib import Path
import streamlit as st
from typing import Optional, List, Tuple, Dict, Any
import time
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime

# MoviePy (video -> audio)
try:
    from moviepy.editor import VideoFileClip
except Exception:
    VideoFileClip = None

from main import analyze_audio, export_practice_audio

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
        # Fallback inline CSS if file doesn't exist
        st.markdown("""
        <style>
        .stApp > div:first-child { padding-top: 0 !important; }
        section[data-testid="stSidebar"] { display: none !important; }
        .main > div { padding-top: 0 !important; }
        div[data-testid="stStatusWidget"] { display: none !important; }
        body { background: #0F0F23; color: white; }
        .section-spacing { margin: 24px 0; }
        .control-panel { 
            background: #1E1F3F; 
            padding: 28px; 
            border-radius: 12px; 
            border: 1px solid #374151; 
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .section-title {
            color: #B4B7C7; 
            font-size: 0.95rem; 
            font-weight: 600; 
            margin: 24px 0 12px 0; 
            text-transform: uppercase; 
            letter-spacing: 0.05em;
            border-bottom: 1px solid #374151;
            padding-bottom: 8px;
        }
        
        /* Better audio player styling */
        audio {
            width: 100%;
            margin: 8px 0;
        }
        
        /* Improve button spacing */
        .stButton > button {
            margin: 4px 0;
        }
        </style>
        """, unsafe_allow_html=True)

load_css()

# Constants
DATA_DIR = Path("data")
OUT_DIR = Path("outputs")
DATA_DIR.mkdir(exist_ok=True)
OUT_DIR.mkdir(exist_ok=True)

# Build timestamp
BUILD_TIME = datetime.now().strftime("%Y-%m-%d %H:%M")

# Initialize session state
def init_session_state():
    defaults = {
        "playhead_sec": 0.0,
        "sync_enabled": True,
        "loop": (1, 4),  # bar_start, bar_end
        "style": "Pop",
        "is_playing": False,
        "play_start_time": None,
        "current_time": 0.0,
        "speed": 1.0,
        "active_tab": "Progression",
        "analysis": None,
        "audio_path": None,
        "suggestions_expanded": False
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

@st.cache_data(show_spinner=False)
def load_analysis(audio_path: str, mtime: float):
    """Keyed by (path, mtime) to ensure reload on file change"""
    return analyze_audio(audio_path)

def save_and_extract_audio(upload) -> Path:
    raw = DATA_DIR / upload.name
    raw.write_bytes(upload.getbuffer())
    ext = raw.suffix.lower()
    
    # Always convert to WAV for better web compatibility
    wav = raw.with_suffix(".wav")
    
    if ext in {".mp4", ".mov", ".m4a"}:
        if VideoFileClip is None:
            st.error("🎬 Video files need MoviePy: `pip install moviepy`")
            st.stop()
        
        try:
            with st.spinner("🎬 Extracting and converting audio..."):
                clip = VideoFileClip(str(raw))
                clip.audio.write_audiofile(str(wav), verbose=False, logger=None)
                clip.close()
            return wav
        except Exception as e:
            st.error(f"Video extraction failed: {e}")
            st.stop()
    
    elif ext in {".mp3", ".m4a", ".flac", ".ogg"}:
        try:
            with st.spinner("🔄 Converting audio to WAV..."):
                import librosa
                import soundfile as sf
                y, sr = librosa.load(str(raw), sr=None)
                sf.write(str(wav), y, sr)
            return wav
        except Exception as e:
            st.error(f"Audio conversion failed: {e}")
            st.stop()
    
    return raw if ext == ".wav" else wav

# Helper functions for chord formatting and timeline mapping
def format_chord_label(label: str, key: Dict = None) -> str:
    """Format chord label with enharmonic equivalents based on key"""
    if not label or label == "N":
        return "♪"
    
    # Basic cleanup
    label = label.replace(":Maj", "").replace(":min", "m")
    
    # Enharmonic spelling based on key
    if key:
        key_name = key.get("tonic_name", "C")
        mode = key.get("mode", "major")
        
        # Use flats in flat keys, sharps otherwise
        flat_keys = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"]
        use_flats = key_name in flat_keys
        
        if use_flats:
            label = label.replace("C#", "Db").replace("D#", "Eb").replace("F#", "Gb")
            label = label.replace("G#", "Ab").replace("A#", "Bb")
        else:
            label = label.replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#")
            label = label.replace("Ab", "G#").replace("Bb", "A#")
    
    return label

def color_for_chord(label: str) -> str:
    """Map chord labels to colors based on chord quality"""
    if not label or label == "N" or label == "♪":
        return "#6B7280"  # Gray for no chord
    
    label_lower = label.lower()
    
    if "dim" in label_lower:
        return "#6B7280"  # Diminished - gray
    elif "aug" in label_lower or "+" in label:
        return "#EC4899"  # Augmented - pink
    elif "sus" in label_lower:
        return "#06B6D4"  # Suspended - cyan
    elif any(ext in label for ext in ["9", "11", "13"]):
        return "#EF4444"  # Extended - red
    elif "7" in label:
        return "#F59E0B"  # Seventh - orange
    elif "m" in label_lower:
        return "#8B5CF6"  # Minor - purple
    else:
        return "#10B981"  # Major - green

def bars_from_beats(beats: List[float], numerator: int) -> List[Tuple[int, float, float]]:
    """Convert beat list to bar timing info"""
    bars = []
    if not beats or numerator <= 0:
        return bars
    
    beats_per_bar = numerator
    for i in range(0, len(beats), beats_per_bar):
        bar_index = i // beats_per_bar
        start_time = beats[i]
        end_time = beats[i + beats_per_bar] if i + beats_per_bar < len(beats) else beats[-1] + 2.0
        bars.append((bar_index, start_time, end_time))
    
    return bars

def suggest_next_chords(state: Dict) -> List[str]:
    """Rule-based chord suggestions based on style and current context"""
    if not state.get("analysis"):
        return []
    
    style = state.get("style", "Pop")
    key = state.get("analysis", {}).get("key", {"tonic_name": "C", "mode": "major"})
    current_time = state.get("current_time", 0.0)
    
    # Get current chord context
    chords = state.get("analysis", {}).get("chords", [])
    current_chord = None
    for start, end, label in chords:
        if start <= current_time <= end:
            current_chord = label
            break
    
    if not current_chord:
        current_chord = chords[0][2] if chords else "C"
    
    # Basic diatonic progressions by style
    tonic = key.get("tonic_name", "C")
    mode = key.get("mode", "major")
    
    # Simple rule-based suggestions
    if mode == "major":
        if style == "Pop":
            base_chords = [f"{tonic}", f"F", f"G", f"Am", f"Dm"]
        elif style == "Rock":
            base_chords = [f"{tonic}", f"F", f"G", f"{tonic}5"]
        elif style == "Jazz":
            base_chords = [f"{tonic}maj7", f"Dm7", f"G7", f"Am7", f"F maj7"]
        elif style == "Worship":
            base_chords = [f"{tonic}", f"G", f"Am", f"F", f"Dm"]
        elif style == "Classical":
            base_chords = [f"{tonic}", f"Dm", f"G", f"Am", f"F"]
        elif style == "EDM":
            base_chords = [f"{tonic}m", f"F", f"G", f"Am"]
        elif style == "R&B":
            base_chords = [f"{tonic}maj7", f"Am7", f"Dm7", f"G7"]
        else:
            base_chords = [f"{tonic}", f"F", f"G", f"Am"]
    else:  # minor
        if style in ["Pop", "Rock"]:
            base_chords = [f"{tonic}m", f"F", f"G", f"Bb"]
        elif style == "Jazz":
            base_chords = [f"{tonic}m7", f"F maj7", f"G7", f"Bb maj7"]
        else:
            base_chords = [f"{tonic}m", f"F", f"G", f"Am"]
    
    # Return 4-5 suggestions, avoiding the current chord
    suggestions = [chord for chord in base_chords if chord != current_chord][:4]
    
    # Add one "spicy" chord based on style
    if style == "Jazz":
        suggestions.append(f"{tonic}maj7#11")
    elif style == "R&B":
        suggestions.append(f"{tonic}add9")
    elif style in ["EDM", "Pop"]:
        suggestions.append(f"{tonic}sus4")
    
    return suggestions[:5]

def render_timeline_matplotlib(chords, beats, current_time, duration, bars_info):
    """Render chord timeline using matplotlib"""
    if not chords:
        st.write("No chords to display")
        return
        
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(18, 8), facecolor='#1E1F3F')
    fig.patch.set_facecolor('#1E1F3F')
    plt.subplots_adjust(hspace=0.4, left=0.05, right=0.98, top=0.95, bottom=0.15)
    
    # Beat ruler (top)
    ax1.set_xlim(0, min(duration, 60))  # Show first 60 seconds
    ax1.set_ylim(0, 1)
    ax1.set_facecolor('#2D2F4A')
    
    # Draw beat markers
    for i, beat_time in enumerate(beats[:200]):  # Limit for performance
        if beat_time > 60:
            break
        ax1.axvline(beat_time, color='#4B5563', alpha=0.5, linewidth=1)
        if i % 4 == 0:  # Bar lines
            ax1.axvline(beat_time, color='#6C63FF', alpha=0.8, linewidth=2)
    
    ax1.set_xticks([])
    ax1.set_yticks([])
    ax1.set_title("Beat Ruler", color='white', fontsize=14, pad=15, fontweight='bold')
    
    # Chord timeline (bottom)  
    ax2.set_xlim(0, min(duration, 60))
    ax2.set_ylim(0, 1)
    ax2.set_facecolor('#252647')
    
    # Draw chord blocks
    for start, end, label in chords:
        if start > 60:
            break
        width = min(end - start, 60 - start)
        if width <= 0:
            continue
            
        color = color_for_chord(label)
        rect = patches.Rectangle((start, 0.1), width, 0.8, 
                               linewidth=1, edgecolor='white', 
                               facecolor=color, alpha=0.8)
        ax2.add_patch(rect)
        
        # Add label if wide enough
        if width > 1.0:
            ax2.text(start + width/2, 0.5, format_chord_label(label), 
                    ha='center', va='center', color='white', 
                    fontsize=12, weight='bold', 
                    bbox=dict(boxstyle='round,pad=0.3', facecolor='black', alpha=0.8, edgecolor='white', linewidth=0.5))
    
    # Playhead
    if 0 <= current_time <= 60:
        ax1.axvline(current_time, color='#6C63FF', linewidth=3, alpha=0.9)
        ax2.axvline(current_time, color='#6C63FF', linewidth=3, alpha=0.9)
    
    ax2.set_xlabel("Time (seconds)", color='white', fontsize=11)
    ax2.set_xticks(range(0, min(int(duration) + 1, 61), 5))
    ax2.set_yticks([])
    ax2.set_title("Chord Progression", color='white', fontsize=14, pad=15, fontweight='bold')
    
    # Style the plot
    for ax in [ax1, ax2]:
        ax.spines['top'].set_color('white')
        ax.spines['bottom'].set_color('white') 
        ax.spines['left'].set_color('white')
        ax.spines['right'].set_color('white')
        ax.tick_params(colors='white')
    
    plt.tight_layout()
    st.pyplot(fig, use_container_width=True)
    plt.close()

# Main UI Layout
st.markdown(f"""
<div class="app-header">
    <h1>🎹 Chord & Melody Extractor</h1>
    <div class="subtitle">Timeline-Centric Chord Analysis & Practice Tool</div>
    <div class="build-version">Build: {BUILD_TIME}</div>
</div>
""", unsafe_allow_html=True)

# Hard Reload Button
if st.button("🔄 Hard Reload", help="Clear cache and restart"):
    st.cache_data.clear()
    st.rerun()

# Two-pane layout with better spacing
col_left, col_right = st.columns([2, 5], gap="large")

# LEFT PANEL - Controls
with col_left:
    st.markdown("""
    <div class="control-panel">
        <h3 style="color: #6C63FF; margin: 0 0 20px 0; font-size: 1.3rem; display: flex; align-items: center; gap: 8px;">
            🎛️ Controls
        </h3>
    """, unsafe_allow_html=True)
    
    # Upload Section
    st.markdown('<div class="section-title">Audio Input</div>', unsafe_allow_html=True)
    uploaded = st.file_uploader("Choose audio file", type=["mp3", "wav", "mp4", "mov", "m4a"])
    
    if uploaded:
        st.session_state.audio_path = save_and_extract_audio(uploaded)
        
        # Audio player with clear spacing and title
        st.markdown('<div style="margin: 20px 0 8px 0; color: #B4B7C7; font-weight: 600;">🎵 Audio Player</div>', unsafe_allow_html=True)
        
        # Debug info
        st.caption(f"File: {st.session_state.audio_path.name} ({st.session_state.audio_path.suffix})")
        
        # Audio player - try different formats
        try:
            if st.session_state.audio_path.suffix.lower() == '.wav':
                st.audio(str(st.session_state.audio_path), format="audio/wav")
            elif st.session_state.audio_path.suffix.lower() == '.mp3':
                st.audio(str(st.session_state.audio_path), format="audio/mp3")
            else:
                st.audio(str(st.session_state.audio_path))
                
            # Also show file size for debugging
            file_size = st.session_state.audio_path.stat().st_size
            st.caption(f"Size: {file_size / 1024 / 1024:.1f} MB")
            
        except Exception as e:
            st.error(f"Audio player error: {e}")
            
        st.markdown('<div style="margin: 12px 0;"></div>', unsafe_allow_html=True)
        
        # Auto-analyze
        with st.spinner("🔍 Analyzing..."):
            try:
                mtime = os.path.getmtime(str(st.session_state.audio_path))
            except:
                mtime = time.time()
            st.session_state.analysis = load_analysis(str(st.session_state.audio_path), float(mtime))
        
        st.success("✅ Analysis complete!")
    
    if st.session_state.analysis:
        # Speed Control
        st.markdown('<div class="section-title">Playback</div>', unsafe_allow_html=True)
        st.session_state.speed = st.slider("Practice Speed", 0.5, 1.25, st.session_state.speed, 0.05)
        
        # Style Selector
        st.markdown('<div class="section-title">AI Style</div>', unsafe_allow_html=True)
        styles = ["Pop", "Rock", "Jazz", "Worship", "Classical", "EDM", "R&B"]
        st.session_state.style = st.selectbox("Genre/Style", styles, index=styles.index(st.session_state.style))
        
        # Key & Tempo Display
        key = st.session_state.analysis.get("key", {"tonic_name": "C", "mode": "major"})
        tempo = st.session_state.analysis.get("tempo", 120)
        time_sig = st.session_state.analysis.get("time_signature", {"numerator": 4, "denominator": 4})
        
        st.markdown('<div class="section-title">Song Info</div>', unsafe_allow_html=True)
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Key", f"{key.get('tonic_name', 'C')} {key.get('mode', 'major')}")
            st.metric("BPM", f"{tempo:.0f}")
        with col2:
            st.metric("Time Sig", f"{time_sig.get('numerator', 4)}/{time_sig.get('denominator', 4)}")
        
        # Sync Toggle
        st.markdown('<div class="section-title">Sync</div>', unsafe_allow_html=True)
        st.session_state.sync_enabled = st.checkbox("Auto-sync playhead", st.session_state.sync_enabled)
        
        # Loop Controls
        st.markdown('<div class="section-title">Loop Practice</div>', unsafe_allow_html=True)
        beats = st.session_state.analysis.get("beats", [])
        bars_info = bars_from_beats(beats, time_sig.get("numerator", 4))
        max_bars = len(bars_info) if bars_info else 8
        
        col1, col2 = st.columns(2)
        with col1:
            loop_start = st.number_input("Start Bar", 1, max_bars, st.session_state.loop[0])
        with col2:
            loop_end = st.number_input("End Bar", loop_start, max_bars, max(st.session_state.loop[1], loop_start))
        st.session_state.loop = (loop_start, loop_end)
        
        # Control Buttons
        st.markdown('<div class="section-title">Actions</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🎹 Analyze", use_container_width=True, type="primary", disabled=True):
                # Already analyzed on upload
                pass
        with col2:
            play_label = "⏹️ Stop" if st.session_state.is_playing else "▶️ Start"
            if st.button(play_label, use_container_width=True):
                st.session_state.is_playing = not st.session_state.is_playing
                if st.session_state.is_playing:
                    st.session_state.play_start_time = time.time()
                else:
                    st.session_state.play_start_time = None
                st.rerun()
        
        # Export Loop
        if st.button("📁 Export Loop (WAV)", use_container_width=True):
            if bars_info and st.session_state.loop[0] <= len(bars_info):
                try:
                    # Calculate loop time range
                    start_bar_idx = st.session_state.loop[0] - 1
                    end_bar_idx = min(st.session_state.loop[1] - 1, len(bars_info) - 1)
                    start_time = bars_info[start_bar_idx][1]
                    end_time = bars_info[end_bar_idx][2]
                    
                    # This would need implementation in practice.py
                    st.info(f"Export feature: Loop bars {st.session_state.loop[0]}-{st.session_state.loop[1]} ({start_time:.1f}s-{end_time:.1f}s)")
                except Exception as e:
                    st.error(f"Export error: {e}")
            else:
                st.error("Invalid loop range")
        
        # Download JSON
        if st.button("📄 Download JSON", use_container_width=True):
            json_data = json.dumps(st.session_state.analysis, indent=2)
            st.download_button("⬇️ Download", json_data, f"analysis_{int(time.time())}.json", "application/json")
    
    st.markdown('</div>', unsafe_allow_html=True)

# RIGHT PANEL - Stage
with col_right:
    if st.session_state.analysis:
        # Update current time if playing
        if st.session_state.is_playing and st.session_state.play_start_time and st.session_state.sync_enabled:
            elapsed = time.time() - st.session_state.play_start_time
            st.session_state.current_time = elapsed * st.session_state.speed
        
        # Extract analysis data
        chords = [(float(c[0]), float(c[1]), format_chord_label(str(c[2]), key)) 
                 for c in st.session_state.analysis.get("chords", [])]
        beats = [float(b) for b in st.session_state.analysis.get("beats", [])]
        melody_notes = st.session_state.analysis.get("melody_notes", [])
        duration = max([end for _, end, _ in chords] + [30.0]) if chords else 30.0
        
        # Now Playing Badge
        current_chord = "♪"
        for start, end, label in chords:
            if start <= st.session_state.current_time <= end:
                current_chord = label
                break
        
        # Calculate bar position
        bars_info = bars_from_beats(beats, time_sig.get("numerator", 4))
        current_bar = 1
        current_beat = 1
        for i, (bar_idx, bar_start, bar_end) in enumerate(bars_info):
            if bar_start <= st.session_state.current_time < bar_end:
                current_bar = bar_idx + 1
                # Calculate beat within bar
                beats_in_bar = [b for b in beats if bar_start <= b < bar_end]
                for j, beat_time in enumerate(beats_in_bar):
                    if beat_time <= st.session_state.current_time:
                        current_beat = j + 1
                break
        
        st.markdown(f"""
        <div class="now-playing">
            <div class="current-chord">{current_chord}</div>
            <div class="chord-meta">
                <span class="next-chord">Key: {key.get('tonic_name', 'C')} {key.get('mode', 'major')}</span>
                <span class="position-info">Bar {current_bar} Beat {current_beat} | {tempo:.0f} BPM</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Chord Timeline
        st.markdown('<div style="font-size: 1.1rem; font-weight: 700; color: white; margin: 24px 0 12px 0;">🎼 Chord Timeline</div>', unsafe_allow_html=True)
        render_timeline_matplotlib(chords, beats, st.session_state.current_time, duration, bars_info)
        
        # Tabbed Detail Area
        st.markdown('<div style="font-size: 1.1rem; font-weight: 700; color: white; margin: 32px 0 16px 0;">📋 Details</div>', unsafe_allow_html=True)
        
        tab1, tab2, tab3, tab4 = st.tabs(["🎼 Progression", "🎹 Melody Roll", "📁 Sections", "🔄 Practice"])
        
        with tab1:
            # Progression with suggestions
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.write("**Full Chord Progression:**")
                # Show chords in a clean, readable list format
                st.markdown('<div style="margin: 16px 0;"></div>', unsafe_allow_html=True)
                
                # Create a scrollable chord list
                chord_html = '<div style="max-height: 300px; overflow-y: auto; padding: 12px; background: #1a1b3a; border-radius: 8px; border: 1px solid #374151;">'
                for i in range(0, min(len(chords), 30), 4):  # Show 4 chords per row
                    chord_html += '<div style="display: flex; gap: 8px; margin-bottom: 8px;">'
                    for j in range(4):
                        if i + j < len(chords):
                            start, end, label = chords[i + j]
                            is_current = start <= st.session_state.current_time <= end
                            if is_current:
                                style = "flex: 1; background: #6C63FF; color: white; padding: 10px 14px; border-radius: 6px; font-weight: bold; border: 2px solid #8B7FFF; box-shadow: 0 0 15px rgba(108, 99, 255, 0.6); text-align: center;"
                            else:
                                style = "flex: 1; background: #374151; color: white; padding: 10px 14px; border-radius: 6px; border: 1px solid #4B5563; text-align: center; font-weight: 500;"
                            chord_html += f'<div style="{style}">{label}</div>'
                        else:
                            chord_html += '<div style="flex: 1;"></div>'  # Empty space
                    chord_html += '</div>'
                
                chord_html += '</div>'
                st.markdown(chord_html, unsafe_allow_html=True)
                if len(chords) > 30:
                    st.caption(f"Showing first 30 chords. Total: {len(chords)} chords")
            
            with col2:
                # AI Suggestions in a cleaner format
                st.markdown('<div style="background: #1a1b3a; padding: 16px; border-radius: 8px; border: 1px solid #374151;">', unsafe_allow_html=True)
                st.write("**🤖 AI Chord Suggestions**")
                st.caption(f"Style: {st.session_state.style}")
                st.markdown('<div style="margin: 12px 0;"></div>', unsafe_allow_html=True)
                
                suggestions = suggest_next_chords({
                    "analysis": st.session_state.analysis,
                    "style": st.session_state.style,
                    "current_time": st.session_state.current_time
                })
                
                for i, suggestion in enumerate(suggestions):
                    st.markdown(f'<div style="background: #2D2F4A; padding: 12px; border-radius: 6px; margin: 8px 0; border: 1px solid #4B5563;">', unsafe_allow_html=True)
                    st.markdown(f'<div style="font-size: 1.1rem; font-weight: bold; color: #6C63FF; margin-bottom: 8px;">{suggestion}</div>', unsafe_allow_html=True)
                    
                    col_a, col_b, col_c = st.columns(3)
                    with col_a:
                        if st.button("Try", key=f"try_{suggestion}_{i}", use_container_width=True):
                            st.success(f"✨ Previewing: {suggestion}")
                    with col_b:
                        if st.button("Replace", key=f"replace_{suggestion}_{i}", use_container_width=True):
                            st.success(f"🔄 Replaced with: {suggestion}")
                    with col_c:
                        if st.button("Insert", key=f"insert_{suggestion}_{i}", use_container_width=True):
                            st.success(f"➕ Inserted: {suggestion}")
                    st.markdown('</div>', unsafe_allow_html=True)
                
                st.markdown('</div>', unsafe_allow_html=True)
        
        with tab2:
            # Melody Roll
            st.write("**Detailed Melody Roll:**")
            if melody_notes:
                st.info("Melody visualization would appear here")
                note_count = len(melody_notes)
                note_range = max(n[2] for n in melody_notes) - min(n[2] for n in melody_notes) if melody_notes else 0
                st.caption(f"Notes: {note_count} | Range: {note_range} semitones")
            else:
                st.info("No melody notes detected in this audio.")
        
        with tab3:
            # Sections
            sections = st.session_state.analysis.get("sections", {}).get("segments", [])
            if sections:
                st.write("**Song Sections:**")
                for i, (start, end, name) in enumerate(sections):
                    is_current = start <= st.session_state.current_time <= end
                    style = "background: #6C63FF; color: white;" if is_current else "background: #374151; color: white;"
                    
                    col1, col2, col3 = st.columns([2, 1, 1])
                    with col1:
                        st.markdown(f'<div style="{style} padding: 8px; border-radius: 4px; margin: 2px 0;">{name}</div>', unsafe_allow_html=True)
                    with col2:
                        st.caption(f"{start:.1f}s - {end:.1f}s")
                    with col3:
                        if st.button(f"Jump", key=f"jump_{i}"):
                            st.session_state.current_time = start
                            st.rerun()
            else:
                st.info("No sections detected. Try with a longer audio file.")
        
        with tab4:
            # Practice tools
            st.write("**Practice Settings:**")
            
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"Loop: Bars {st.session_state.loop[0]} - {st.session_state.loop[1]}")
                if bars_info and st.session_state.loop[1] <= len(bars_info):
                    loop_duration = bars_info[st.session_state.loop[1]-1][2] - bars_info[st.session_state.loop[0]-1][1]
                    st.caption(f"Duration: {loop_duration:.1f}s")
            
            with col2:
                st.write(f"Speed: {st.session_state.speed}x")
                practice_bpm = tempo * st.session_state.speed
                st.caption(f"Practice BPM: {practice_bpm:.0f}")
            
            # Practice features placeholder
            st.info("🔧 Advanced practice features coming soon: metronome, backing tracks, slow-down without pitch change.")
    
    else:
        # Welcome state
        st.markdown("""
        <div style="text-align: center; padding: 48px; background: #1E1F3F; border-radius: 12px; border: 1px solid #374151;">
            <h2 style="color: #6C63FF; margin-bottom: 16px;">🎵 Upload Audio to Begin</h2>
            <p style="color: #B4B7C7; font-size: 1.1rem; margin-bottom: 24px;">
                Upload an audio file to start analyzing chords and melodies
            </p>
            <div style="color: #9CA3AF; font-size: 0.9rem;">
                Supported formats: MP3, WAV, MP4, MOV, M4A
            </div>
        </div>
        """, unsafe_allow_html=True)

# Fixed Transport Bar (always visible)
# Calculate duration outside the analysis block
duration = 30.0  # Default duration
if st.session_state.analysis:
    chords_for_duration = st.session_state.analysis.get("chords", [])
    if chords_for_duration:
        duration = max([float(c[1]) for c in chords_for_duration] + [30.0])

st.markdown(f"""
<div style="position: fixed; bottom: 0; left: 0; right: 0; background: #2D2F4A; border-top: 1px solid #374151; padding: 12px 24px; display: flex; align-items: center; gap: 24px; z-index: 1000; backdrop-filter: blur(10px);">
    <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: {'#6C63FF' if st.session_state.is_playing else '#374151'}; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
            {'⏸️' if st.session_state.is_playing else '▶️'}
        </div>
    </div>
    <div style="flex: 1; display: flex; align-items: center; gap: 16px;">
        <div style="flex: 1; height: 6px; background: #374151; border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(90deg, #6C63FF, #8B7FFF); border-radius: 3px; transition: width 0.15s ease-in-out; width: {(st.session_state.current_time / max(duration, 1) * 100) if st.session_state.analysis else 0}%;"></div>
        </div>
        <div style="font-family: monospace; font-size: 14px; color: #B4B7C7; font-weight: 600; white-space: nowrap;">
            {st.session_state.current_time:.1f}s / {duration:.1f}s{' | Loop: ' + str(st.session_state.loop[0]) + '-' + str(st.session_state.loop[1]) if st.session_state.analysis else ''}
        </div>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: #374151; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">🔊</div>
        <div style="background: {'#6C63FF' if st.session_state.sync_enabled else '#374151'}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">🔄</div>
    </div>
</div>

<style>
body {{ padding-bottom: 80px; }}
.stApp > div:first-child {{ padding-bottom: 80px; }}
</style>
""", unsafe_allow_html=True)

# Auto-refresh when playing
if st.session_state.is_playing:
    time.sleep(0.5)
    st.rerun()