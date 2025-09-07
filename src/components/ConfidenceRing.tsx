import { cn } from '@/lib/utils';

interface ConfidenceRingProps {
  confidence: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ConfidenceRing({
  confidence,
  size = 120,
  strokeWidth = 8,
  className
}: ConfidenceRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (confidence * circumference);

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 transition-all duration-300"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted-foreground/20"
        />
        
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-500 ease-out",
            confidence > 0.7 ? "text-primary" :
            confidence > 0.4 ? "text-yellow-500" :
            "text-red-500"
          )}
          style={{
            filter: confidence > 0.5 ? 'drop-shadow(0 0 8px currentColor)' : 'none'
          }}
        />
      </svg>
      
      {/* Confidence percentage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          "text-sm font-medium transition-colors duration-300",
          confidence > 0.7 ? "text-primary" :
          confidence > 0.4 ? "text-yellow-600" :
          "text-red-600"
        )}>
          {Math.round(confidence * 100)}%
        </span>
      </div>
    </div>
  );
}