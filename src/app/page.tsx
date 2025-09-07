'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChordTile } from '@/components/ChordTile';
import { ConfidenceRing } from '@/components/ConfidenceRing';
import { Timeline, TimelineSegment } from '@/components/Timeline';
import { FileDrop } from '@/components/FileDrop';
import { ExportMenu } from '@/components/ExportMenu';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useAppStore } from '@/lib/store/useAppStore';
import { AudioProcessor } from '@/lib/audio';
import { formatTime } from '@/lib/utils/time';

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

    try {
      const fileSegments = await audioProcessorRef.current.processFile(file);
      updateSegments(fileSegments);
      
      if (fileSegments.length > 0) {
        const totalDuration = fileSegments[fileSegments.length - 1].endTime;
        setDuration(totalDuration);
        setCurrentTime(0);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    clearSegments();
    setCurrentTime(0);
    setDuration(0);
    setCurrentChord('N/C', 0);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    
    // Find current chord at this time
    const segment = segments.find(
      seg => time >= seg.startTime && time < seg.endTime
    );
    
    if (segment) {
      setCurrentChord(segment.chord, segment.confidence);
    }
  };

  const handlePlayPause = () => {
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
            <ConfidenceRing confidence={currentConfidence} />
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

        {/* Main Interface */}
        <div className="max-w-4xl mx-auto space-y-8">
          <FileDrop
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFile={uploadedFile}
            isProcessing={isProcessing}
            processingProgress={processingProgress}
          />

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
            
            <ExportMenu
              segments={segments}
              detectedKey={detectedKey ? `${detectedKey.key}${detectedKey.mode === 'minor' ? 'm' : ''}` : undefined}
              disabled={segments.length === 0}
            />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}