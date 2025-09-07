#!/usr/bin/env bash
set -e

# Kill old streamlit if running
pkill -f streamlit 2>/dev/null || true

# Clear streamlit cache and outputs
rm -rf ~/.cache/streamlit/* 2>/dev/null || true
rm -f outputs/analysis.json outputs/practice.wav 2>/dev/null || true

# Ensure venv and deps
python3 -m venv .venv || true
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -q --no-input -r <(cat <<'REQ'
streamlit==1.49.*
numpy==1.26.*
matplotlib==3.8.*
plotly==5.*
librosa==0.10.2.post1
soundfile==0.12.*
moviepy==1.0.3
audioread==3.0.1
scikit-learn==1.4.*
REQ
)

# Launch app
python3 -m streamlit run src/ui_streamlit.py --server.address 127.0.0.1 --server.port 8501 --logger.level debug
