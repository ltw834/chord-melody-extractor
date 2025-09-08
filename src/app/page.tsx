'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChordTile } from '@/components/ChordTile';
import { Timeline, TimelineSegment } from '@/components/Timeline';
import { FileDrop } from '@/components/FileDrop';
import { ExportMenu } from '@/components/ExportMenu';
import { SettingsSheet } from '@/components/SettingsSheet';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store/useAppStore';
import { AudioProcessor } from '@/lib/audio';
import { formatTime } from '@/lib/utils/time';
import { MicrophoneManager } from '@/lib/audio/mic';
import { BigListenButton } from '@/components/BigListenButton';
import { Metronome } from '@/lib/audio/metronome';
import { LyricsPanel, WhisperSegment } from '@/components/LyricsPanel';
import { LyricsWithChords } from '@/components/LyricsWithChords';

export default function HomePage() {
  const {
    // State
    isProcessing,
    processingProgress,
    error,
    currentChord,
    currentConfidence,
    segments,
    currentTime,
    duration,
    isPlaying,
    detectedKey,
    detectedTempo,
    settings,
    uploadedFile,
    
    // Actions
    setProcessing,
    setProcessingProgress,
    setError,
    setCurrentChord,
    addSegment,
    updateSegments,
    clearSegments,
    setCurrentTime,
    setDuration,
    setPlaying,
    setDetectedKey,
    setDetectedTempo,
    updateSettings,
    resetSettings,
    setUploadedFile,
    reset
  } = useAppStore();

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const micRef = useRef<MicrophoneManager | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const metronomeRef = useRef<Metronome | null>(null);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [resolveStatus, setResolveStatus] = useState('');
  const [lyrics, setLyrics] = useState<WhisperSegment[]>([]);
  const [useOmnizart, setUseOmnizart] = useState(false);
  
  // Decide whether to fully download and process or stream-attach
  async function tryProcessOrStream(streamUrl: string, title?: string) {
    try {
      // Attempt HEAD to check content length and CORS
      let size = 0;
      try {
        const head = await fetch(streamUrl, { method: 'HEAD' });
        const len = head.headers.get('content-length');
        if (len) size = parseInt(len, 10) || 0;
      } catch {}

      const sizeLimit = 40 * 1024 * 1024; // 40 MB
      if (size > 0 && size <= sizeLimit) {
        const res = await fetch(streamUrl);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], (title || 'audio') + '.mp3', { type: blob.type || 'audio/mpeg' });
          // Use offline pipeline (faster UI, full timeline)
          await handleFileSelect(file);
          if (!audioRef.current) audioRef.current = new Audio();
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          audioRef.current.src = url;
          audioRef.current.load();
          return;
        }
      }
    } catch {}
    // Fallback to streaming analysis
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.crossOrigin = 'anonymous';
    audio.src = streamUrl;
    audio.load();
    await audio.play().catch(() => {});
    await audioProcessorRef.current?.attachElement(audio);
    setPlaying(true);
  }

  // Initialize audio processor
  useEffect(() => {
    const processor = new AudioProcessor(
      {
        vocabularyLevel: settings.vocabularyLevel,
        smoothingStrength: settings.smoothingStrength,
        updateRate: settings.updateRate,
      },
      {
        onChordDetected: (chord, confidence) => {
          setCurrentChord(chord, confidence);
        },
        onSegmentAdded: (segment) => {
          addSegment(segment);
        },
        onKeyDetected: (key, confidence, mode) => {
          setDetectedKey({ key, confidence, mode });
        },
        onTempoDetected: (bpm, confidence) => {
          setDetectedTempo({ bpm, confidence });
        },
        onError: (error) => {
          setError(error);
        },
        onProcessingProgress: (progress) => {
          setProcessingProgress(progress);
        }
      }
    );

    audioProcessorRef.current = processor;

    return () => {
      processor.dispose();
    };
  }, []);

  // Initialize mic manager lazily
  useEffect(() => {
    micRef.current = new MicrophoneManager();
    const mic = micRef.current;
    mic.onStateChanged((state) => {
      setHasMicPermission(state.hasPermission);
    });
    const meter = setInterval(() => {
      if (isListening && mic) setAudioLevel(mic.getAudioLevel());
    }, 100);
    return () => {
      clearInterval(meter);
      mic?.dispose();
    };
  }, [isListening]);

  // Update processor settings when they change
  useEffect(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.updateConfig({
        vocabularyLevel: settings.vocabularyLevel,
        smoothingStrength: settings.smoothingStrength,
        updateRate: settings.updateRate,
      });
    }
  }, [settings]);


  const handleFileSelect = async (file: File) => {
    if (!audioProcessorRef.current) return;

    setUploadedFile(file);
    setProcessing(true);
    setError(null);
    clearSegments();
    setCurrentChord('N/C', 0);

    // Prepare audio element for real playback
    try {
      // Revoke any previous object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      audioRef.current.load();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = () => {
        setPlaying(false);
        setCurrentTime(duration);
      };
    } catch (e) {
      // Non-fatal for analysis; playback may still be simulated
      console.warn('Audio element init failed', e);
    }

    try {
      const fileSegments = await audioProcessorRef.current.processFile(file);
      updateSegments(fileSegments);

      if (fileSegments.length > 0) {
        const totalDuration = fileSegments[fileSegments.length - 1].endTime;
        setDuration(totalDuration);
        setCurrentTime(0);
        // Set current chord to first detected segment so the hero shows a chord
        const first = fileSegments[0];
        setCurrentChord(first.chord, first.confidence);
      } else {
        // No segments found
        setCurrentChord('N/C', 0);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  // Keep timeupdate handler in sync with latest segments
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.ontimeupdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const seg = segments.find(seg => t >= seg.startTime && t < seg.endTime);
      if (seg) setCurrentChord(seg.chord, seg.confidence);
    };
  }, [segments, setCurrentChord, setCurrentTime]);

  // Update duration when media metadata is available
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => { audio.removeEventListener('loadedmetadata', onLoaded); };
  }, [audioRef.current]);

  const handleFileRemove = () => {
    setUploadedFile(null);
    clearSegments();
    setCurrentTime(0);
    setDuration(0);
    setCurrentChord('N/C', 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
    
    // Find current chord at this time
    const segment = segments.find(
      seg => time >= seg.startTime && time < seg.endTime
    );
    
    if (segment) {
      setCurrentChord(segment.chord, segment.confidence);
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
        setPlaying(false);
      } else {
        audio.currentTime = currentTime;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(() => setPlaying(true)).catch(() => {
            // Autoplay blocked or other issue; fallback to simulation
            setPlaying(true);
            simulatePlayback();
          });
        } else {
          setPlaying(true);
        }
      }
      return;
    }
    // Fallback if audio element unavailable
    if (isPlaying) {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      setPlaying(false);
    } else {
      setPlaying(true);
      simulatePlayback();
    }
  };

  // Microphone handlers
  const requestMic = async () => {
    const ok = await micRef.current?.requestPermission();
    setHasMicPermission(!!ok);
  };

  const toggleListen = async () => {
    if (!audioProcessorRef.current || !micRef.current) return;
    if (isListening) {
      micRef.current.stopRecording();
      audioProcessorRef.current.stopStream();
      setIsListening(false);
      return;
    }
    const started = await micRef.current.startRecording();
    if (!started) return;
    setIsListening(true);
    audioProcessorRef.current.startStream();
    // Stream frames into processor
    micRef.current.onAudioDataReceived(async (data, timestamp) => {
      await audioProcessorRef.current?.processAudioFrame(data, timestamp);
    });
  };

  // Metronome
  const toggleMetronome = () => {
    if (!metronomeRef.current) metronomeRef.current = new Metronome(detectedTempo?.bpm || 120);
    const m = metronomeRef.current;
    if (isMetronomeOn) {
      m.stop();
      setIsMetronomeOn(false);
    } else {
      m.setBpm(detectedTempo?.bpm || 120);
      m.start();
      setIsMetronomeOn(true);
    }
  };

  // URL resolver flow
  const resolveAndLoadUrl = async () => {
    try {
      setResolveStatus('Resolving…');
      const r = await fetch('/api/resolve-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: inputUrl })
      });
      const data = await r.json();
      if (!r.ok) { setResolveStatus(data.error || 'Resolve failed'); return; }

      if (data.kind === 'youtube_embed') {
        setResolveStatus('YouTube embed loaded. Note: browsers block capturing audio from cross‑origin iframes; analysis is disabled for embedded playback.');
        const iframe = document.createElement('iframe');
        iframe.src = data.embedUrl;
        iframe.width = '640';
        iframe.height = '360';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.style.border = '0';
        const container = document.getElementById('yt-embed');
        if (container) { container.innerHTML = ''; container.appendChild(iframe); }
      } else if (data.kind === 'youtube_server') {
        setResolveStatus('Streaming YouTube audio via server…');
        await tryProcessOrStream(data.streamUrl, data.title);
        setResolveStatus(`Ready: ${data.title || 'YouTube audio'}`);
      } else if (data.kind === 'soundcloud') {
        setResolveStatus('Loading SoundCloud…');
        await tryProcessOrStream(data.streamUrl, data.title);
        setResolveStatus(`Ready: ${data.title || 'SoundCloud track'}`);
      } else {
        setResolveStatus('Unsupported URL');
      }
    } catch (e: any) {
      setResolveStatus(String(e?.message || e));
    }
  };

  // Transcribe current audio element source (CORS permitting)
  const transcribeCurrent = async () => {
    try {
      setResolveStatus('Transcribing…');
      const audio = audioRef.current;
      if (!audio?.src) { setResolveStatus('No audio to transcribe'); return; }
      const res = await fetch(audio.src);
      if (!res.ok) { setResolveStatus('Unable to fetch audio for transcription'); return; }
      const blob = await res.blob();
  const fd = new FormData();
  fd.append('file', new File([blob], 'audio.mp3'));
  if (useOmnizart) fd.append('use_omnizart', 'true');
  const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) { setResolveStatus(data.error || 'Transcribe failed'); return; }
      setLyrics((data.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })));
      setResolveStatus('Transcription complete');
    } catch (e: any) {
      setResolveStatus(String(e?.message || e));
    }
  };

  const simulatePlayback = () => {
    const updateInterval = 100; // Update every 100ms
    
    const update = () => {
      const newTime = currentTime + updateInterval / 1000;
      
      if (newTime >= duration) {
        setPlaying(false);
        setCurrentTime(duration);
        return;
      }
      
      setCurrentTime(newTime);
      
      // Update current chord
      const segment = segments.find(
        seg => newTime >= seg.startTime && newTime < seg.endTime
      );
      
      if (segment) {
        setCurrentChord(segment.chord, segment.confidence);
      }
      
      if (isPlaying) {
        playbackTimeoutRef.current = setTimeout(update, updateInterval);
      }
    };
    
    update();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        onSettingsClick={() => {}} 
        onExportClick={() => {}}
      />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Hear it. See it. Play it.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Chord recognition from your audio files—fast, clean, on your phone.
          </p>
          
          {/* Current Chord Display */}
          <div className="flex items-center justify-center space-x-8 mb-8">
            <ChordTile 
              chord={currentChord}
              confidence={currentConfidence}
              isActive={isPlaying}
              className="scale-110"
            />
          </div>

          {/* Music Info */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            {detectedKey && detectedKey.confidence > 0.6 && (
              <Badge variant="outline">
                Key: {detectedKey.key} {detectedKey.mode}
              </Badge>
            )}
            {detectedTempo && detectedTempo.confidence > 0.5 && (
              <Badge variant="outline">
                Tempo: {detectedTempo.bpm} BPM
              </Badge>
            )}
            {duration > 0 && (
              <Badge variant="outline">
                Duration: {formatTime(duration)}
              </Badge>
            )}
          </div>
        </div>

        {/* URL Input / External sources */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              placeholder="Paste YouTube or SoundCloud URL"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <Button size="sm" onClick={resolveAndLoadUrl}>Load</Button>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={useOmnizart} onChange={(e) => setUseOmnizart(e.target.checked)} className="w-4 h-4" />
              <span>Use Omnizart (advanced)</span>
            </label>
            <Button size="sm" variant="outline" onClick={transcribeCurrent}>Transcribe</Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">{resolveStatus}</div>
          <div id="yt-embed" className="mt-3"></div>
        </div>

        {/* Main Interface */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Input sources */}
          <div className="grid md:grid-cols-2 gap-6">
            <FileDrop
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              selectedFile={uploadedFile}
              isProcessing={isProcessing}
              processingProgress={processingProgress}
            />

            <div className="border-2 border-border rounded-lg p-6 flex flex-col items-center justify-center">
              <BigListenButton
                isListening={isListening}
                hasPermission={hasMicPermission}
                audioLevel={audioLevel}
                onToggleListen={toggleListen}
                onRequestPermission={requestMic}
              />
            </div>
          </div>

          {segments.length > 0 && (
            <Timeline
              segments={segments}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              onPlayPause={handlePlayPause}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mt-8">
            <SettingsSheet
              settings={settings}
              onSettingsChange={updateSettings}
              onResetSettings={resetSettings}
            />
            <div className="flex items-center space-x-2">
              <label className="text-sm text-muted-foreground">Speed</label>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={playbackRate}
                onChange={(e) => {
                  const r = parseFloat(e.target.value);
                  setPlaybackRate(r);
                  if (audioRef.current) audioRef.current.playbackRate = r;
                }}
              />
              <span className="text-sm w-10 text-right">{playbackRate.toFixed(2)}x</span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleMetronome}>
              {isMetronomeOn ? 'Stop Metronome' : 'Start Metronome'}
            </Button>
            
            <ExportMenu
              segments={segments}
              detectedKey={detectedKey ? `${detectedKey.key}${detectedKey.mode === 'minor' ? 'm' : ''}` : undefined}
              disabled={segments.length === 0}
            />
          </div>
        </div>
      </main>
      {lyrics.length > 0 && (
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <LyricsWithChords lyrics={lyrics} chords={segments} />
            <LyricsPanel segments={lyrics} />
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}
