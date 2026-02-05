import { CSSProperties } from "react";

interface DeckMeterProps {
  remaining: number;
  total: number;
  thresholdPercent?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
  showStatusText?: boolean;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const DeckMeter = ({
  remaining,
  total,
  thresholdPercent = 25,
  size = 64,
  strokeWidth = 6,
  label = "Deck",
  className = "",
  showStatusText = true,
}: DeckMeterProps) => {
  const percent = total > 0 ? (remaining / total) * 100 : 0;
  const clamped = clampPercent(percent);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const isLow = clamped <= thresholdPercent;
  const isMid = clamped <= 50;
  const ringClass = isLow ? "text-red-500" : isMid ? "text-amber-500" : "text-emerald-500";

  const ringStyle: CSSProperties = {
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset,
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            stroke="currentColor"
            className="text-muted-foreground/25"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            stroke="currentColor"
            className={ringClass}
            fill="transparent"
            strokeLinecap="round"
            style={ringStyle}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {Math.round(clamped)}%
        </div>
      </div>
      <div className="flex flex-col">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold">
          {remaining} / {total} cards
        </div>
        {showStatusText && (
          <div className={`text-[10px] ${isLow ? "text-red-400" : "text-muted-foreground"}`}>
            {isLow ? `Below ${thresholdPercent}% - reshuffle` : "Shoe OK"}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeckMeter;
