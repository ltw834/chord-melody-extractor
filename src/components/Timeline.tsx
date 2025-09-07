import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/utils/time';
import { cn } from '@/lib/utils';

export interface TimelineSegment {
  chord: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface TimelineProps {
  segments: TimelineSegment[];
  currentTime?: number;
  duration: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
  className?: string;
}

export function Timeline({
  segments,
  currentTime = 0,
  duration,
  isPlaying = false,
  onSeek,
  onPlayPause,
  className
}: TimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep current time visible
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    const totalWidth = container.scrollWidth;
    const scrollPosition = (currentTime / duration) * totalWidth;
    
    // Center the current position
    const targetScroll = scrollPosition - containerWidth / 2;
    
    container.scrollTo({
      left: Math.max(0, Math.min(targetScroll, totalWidth - containerWidth)),
      behavior: isDragging ? 'auto' : 'smooth'
    });
  }, [currentTime, duration, isDragging]);

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timelineRef.current || !onSeek) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const handleSegmentClick = (segment: TimelineSegment) => {
    if (onSeek) {
      onSeek(segment.startTime);
    }
  };

  const currentSegment = segments.find(
    segment => currentTime >= segment.startTime && currentTime < segment.endTime
  );

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Current Chord Display */}
      {currentSegment && (
        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <h3 className="text-2xl font-bold">{currentSegment.chord}</h3>
            <p className="text-sm text-muted-foreground">
              {formatTime(currentSegment.startTime)} - {formatTime(currentSegment.endTime)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              {Math.round(currentSegment.confidence * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">confidence</div>
          </div>
        </div>
      )}

      {/* Playback Controls */}
      {onPlayPause && (
        <div className="flex items-center justify-center space-x-4">
          <Button
            onClick={onPlayPause}
            variant="outline"
            size="sm"
            className="w-12 h-12 rounded-full"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <div className="text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* Timeline Scrubber */}
      <div className="space-y-2">
        <div
          ref={timelineRef}
          className="relative h-12 bg-muted rounded-lg cursor-pointer overflow-hidden"
          onClick={handleTimelineClick}
        >
          {/* Progress indicator */}
          <div
            className="absolute top-0 left-0 h-full bg-primary/20 transition-all duration-100"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          
          {/* Current time marker */}
          <div
            className="absolute top-0 w-0.5 h-full bg-primary shadow-lg transition-all duration-100"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Chord Segments */}
      {segments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Chord Progression</h4>
          
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto pb-2"
          >
            <div className="flex space-x-2 min-w-full">
              {segments.map((segment, index) => {
                const isActive = currentTime >= segment.startTime && currentTime < segment.endTime;
                const width = Math.max(60, ((segment.endTime - segment.startTime) / duration) * 400);
                
                return (
                  <button
                    key={index}
                    onClick={() => handleSegmentClick(segment)}
                    className={cn(
                      "timeline-segment flex flex-col items-center justify-center",
                      "min-h-16 px-3 py-2 text-sm rounded-lg border transition-all",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary",
                      isActive && "timeline-segment active bg-primary/20 border-primary",
                      !isActive && segment.confidence > 0.5 && "border-border bg-card",
                      !isActive && segment.confidence <= 0.5 && "border-muted bg-muted/50"
                    )}
                    style={{ minWidth: `${width}px` }}
                  >
                    <div className="font-medium">{segment.chord}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(segment.startTime)}
                    </div>
                    <div className="text-xs opacity-60">
                      {Math.round(segment.confidence * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {segments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No chord segments detected yet.</p>
          <p className="text-sm">Start listening or upload an audio file to see the timeline.</p>
        </div>
      )}
    </div>
  );
}