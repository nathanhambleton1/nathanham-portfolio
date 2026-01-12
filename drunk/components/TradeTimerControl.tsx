import React from 'react';
import { Button } from './ui/button';

export default function TradeTimerControl({
  tradeLocked = false,
  currentSeconds = 60,
  selected,
  onSelect,
}: {
  tradeLocked?: boolean;
  currentSeconds?: number;
  selected?: number;
  onSelect?: (s: number) => void;
}) {
  const options = [60, 120, 180];
  const sel = selected ?? currentSeconds ?? 60;

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex rounded-md border bg-card p-2">
        {options.map((s) => (
          <Button
            key={s}
            variant={sel === s ? 'default' : 'ghost'}
            size="sm"
            className={`px-3 py-1 rounded ${sel === s ? 'bg-primary text-white' : ''}`}
            onClick={() => onSelect && onSelect(s)}
            disabled={tradeLocked}
          >
            {s / 60}m
          </Button>
        ))}
      </div>
    </div>
  );
}
