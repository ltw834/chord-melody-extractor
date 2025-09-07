import { cn } from '@/lib/utils';

interface ChordTileProps {
  chord: string;
  confidence: number;
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ChordTile({
  chord,
  confidence,
  isActive = false,
  className,
  onClick
}: ChordTileProps) {
  // Handle special case for N/C (No Chord)
  if (chord === 'N/C') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "chord-tile relative flex flex-col items-center justify-center",
          "min-h-24 p-6 cursor-pointer select-none",
          "border-2 rounded-xl transition-all duration-300",
          "bg-card hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary",
          isActive && "chord-tile active border-primary bg-primary/10 shadow-lg scale-105",
          !isActive && confidence > 0.5 && "border-primary/30",
          !isActive && confidence <= 0.5 && "border-border",
          className
        )}
        tabIndex={onClick ? 0 : -1}
        role={onClick ? "button" : undefined}
        aria-label={`No chord detected, confidence ${Math.round(confidence * 100)}%`}
      >
        {/* Chord name */}
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-bold leading-none text-muted-foreground">
            N/C
          </span>
        </div>
        
        {/* Confidence indicator */}
        <div className="mt-2 flex items-center space-x-2">
          <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                confidence > 0.7 ? "bg-primary" :
                confidence > 0.4 ? "bg-yellow-500" :
                "bg-red-500"
              )}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {Math.round(confidence * 100)}
          </span>
        </div>
        
        {/* Active pulse animation */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl border-2 border-primary animate-confidence-pulse pointer-events-none" />
        )}
      </div>
    );
  }

  const chordRoot = chord.replace(/[^A-G#b]/g, '');
  const chordQuality = chord.replace(/^[A-G#b]+/, '');
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "chord-tile relative flex flex-col items-center justify-center",
        "min-h-24 p-6 cursor-pointer select-none",
        "border-2 rounded-xl transition-all duration-300",
        "bg-card hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary",
        isActive && "chord-tile active border-primary bg-primary/10 shadow-lg scale-105",
        !isActive && confidence > 0.5 && "border-primary/30",
        !isActive && confidence <= 0.5 && "border-border",
        className
      )}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? "button" : undefined}
      aria-label={`Chord ${chord}, confidence ${Math.round(confidence * 100)}%`}
    >
      {/* Chord name */}
      <div className="flex items-baseline space-x-1">
        <span className="text-3xl font-bold leading-none">
          {chordRoot}
        </span>
        {chordQuality && (
          <span className="text-lg font-medium text-muted-foreground">
            {chordQuality}
          </span>
        )}
      </div>
      
      {/* Confidence indicator */}
      <div className="mt-2 flex items-center space-x-2">
        <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              confidence > 0.7 ? "bg-primary" :
              confidence > 0.4 ? "bg-yellow-500" :
              "bg-red-500"
            )}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {Math.round(confidence * 100)}
        </span>
      </div>
      
      {/* Active pulse animation */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl border-2 border-primary animate-confidence-pulse pointer-events-none" />
      )}
    </div>
  );
}