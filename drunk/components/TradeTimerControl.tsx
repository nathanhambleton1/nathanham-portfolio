import React, { useState } from 'react';

export default function TradeTimerControl({
  tradeLocked = false,
  currentSeconds = 60,
  onStart,
  onStop,
}: {
  tradeLocked?: boolean;
  currentSeconds?: number;
  onStart: (seconds: number) => void;
  onStop: () => void;
}) {
  const options = [60, 120, 180];
  const [selected, setSelected] = useState<number>(currentSeconds || 60);

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex rounded-md border bg-card p-2">
        {options.map((s) => (
          <button
            key={s}
            className={`px-3 py-1 text-sm rounded ${selected === s ? 'bg-primary text-white' : 'bg-transparent'}`}
            onClick={() => setSelected(s)}
            disabled={tradeLocked}
          >
            {s / 60}m
          </button>
        ))}
      </div>

      {!tradeLocked ? (
        <button
          className="px-3 py-1 rounded bg-primary text-white text-sm"
          onClick={() => onStart(selected)}
        >
          Start
        </button>
      ) : (
        <button className="px-3 py-1 rounded bg-red-600 text-white text-sm" onClick={onStop}>
          Done
        </button>
      )}
    </div>
  );
}
