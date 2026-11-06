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
  const options = [30, 60, 120];
  const sel = selected ?? currentSeconds ?? 60;

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex gap-1 rounded-full border border-foreground/10 bg-foreground/[0.03] p-1 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        {options.map((s) => (
          <Button
            key={s}
            variant={sel === s ? 'default' : 'ghost'}
            size="sm"
            className={`h-10 min-w-[3rem] rounded-full px-4 font-display tabular-nums tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              sel === s ? '' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onSelect && onSelect(s)}
            disabled={tradeLocked}
          >
            {s < 60 ? `${s}s` : `${s / 60}m`}
          </Button>
        ))}
      </div>
    </div>
  );
}
