import { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BigListenButtonProps {
  isListening: boolean;
  hasPermission: boolean;
  isLoading?: boolean;
  audioLevel?: number;
  onToggleListen: () => void;
  onRequestPermission: () => void;
  className?: string;
}

export function BigListenButton({
  isListening,
  hasPermission,
  isLoading = false,
  audioLevel = 0,
  onToggleListen,
  onRequestPermission,
  className
}: BigListenButtonProps) {
  const handleClick = () => {
    if (!hasPermission) {
      onRequestPermission();
    } else {
      onToggleListen();
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Loading...';
    if (!hasPermission) return 'Allow Microphone';
    return isListening ? 'Stop Listening' : 'Start Listening';
  };

  const getIcon = () => {
    if (!hasPermission) {
      return <VolumeX className="w-8 h-8" />;
    }
    return isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />;
  };

  return (
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      {/* Main Listen Button */}
      <Button
        onClick={handleClick}
        disabled={isLoading}
        size="xl"
        className={cn(
          "relative w-32 h-32 rounded-full transition-all duration-300",
          "flex flex-col items-center justify-center space-y-2",
          "text-white font-semibold shadow-lg",
          isListening && "animate-pulse bg-red-500 hover:bg-red-600",
          !isListening && hasPermission && "bg-primary hover:bg-primary/90",
          !hasPermission && "bg-yellow-500 hover:bg-yellow-600",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        {getIcon()}
        <span className="text-xs text-center leading-tight">
          {getButtonText()}
        </span>
        
        {/* Audio level visualization */}
        {isListening && audioLevel > 0 && (
          <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" 
               style={{ animationDuration: `${2 - audioLevel}s` }} />
        )}
      </Button>

      {/* Audio Level Meter */}
      {isListening && (
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-100 rounded-full"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}

      {/* Status Text */}
      <div className="text-center text-sm text-muted-foreground max-w-xs">
        {!hasPermission && (
          <p>ChordSnap needs microphone access to detect chords from your audio.</p>
        )}
        {hasPermission && !isListening && (
          <p>Ready to listen. Tap the button to start chord detection.</p>
        )}
        {hasPermission && isListening && (
          <p>Listening... Play your instrument or audio to see chord detection.</p>
        )}
      </div>
    </div>
  );
}