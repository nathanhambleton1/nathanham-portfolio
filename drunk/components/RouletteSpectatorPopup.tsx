import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { WheelSVG, numColor, numLabel, type RouletteSpinBroadcast } from './RoulettePopup';

export default function RouletteSpectatorPopup({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: RouletteSpinBroadcast | null;
}) {
  const [phase, setPhase] = useState<'spinning' | 'result'>('spinning');
  // Start at 0 so the CSS transition has something to animate from
  const [rotation, setRotation] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !data) return;
    setPhase('spinning');
    setRotation(0);

    // Wait two frames so the browser paints rotation=0 before we set the target,
    // which is what triggers the CSS spin transition.
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setRotation(data.rotation);
      });
    });

    timer.current = setTimeout(() => {
      setPhase('result');
      timer.current = setTimeout(() => onOpenChange(false), 6000);
    }, 4200);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, data]);

  if (!data) return null;

  const resultColor = data.resultNum != null ? numColor(data.resultNum) : 'green';
  const resultLabel = data.resultNum != null ? numLabel(data.resultNum) : '?';
  const oddsLabel = `${data.payoutMultiplier - 1}:1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-w-sm"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-foreground/10">
          <div className="mb-2 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
            Live roulette
          </div>
          <div className="flex items-center justify-center gap-2">
            {data.spinnerAvatar && (
              <img src={data.spinnerAvatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-foreground/10 flex-shrink-0" />
            )}
            <div className="text-center">
              <div className="font-display text-base font-semibold tracking-tight text-foreground leading-tight">
                {data.spinnerName || 'A player'} is gambling!
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ${data.amount.toLocaleString()} on{' '}
                <span className="font-semibold text-foreground">{data.betLabel}</span>
                {' '}·{' '}
                <span className="text-brand">{oddsLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wheel + status */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 items-center">
          <div className="relative" style={{ width: 200, height: 200 }}>
            <WheelSVG rotation={rotation} phase={phase} />
          </div>

          <div className="text-center min-h-[3.5rem]">
            {phase === 'spinning' && (
              <p className="text-brand animate-pulse font-semibold text-sm">Spinning...</p>
            )}
            {phase === 'result' && (
              <div>
                <div className={`font-display text-2xl font-bold tracking-tight ${data.won ? 'text-emerald-500' : 'text-destructive'}`}>
                  {data.won ? `${data.spinnerName} Won!` : `${data.spinnerName} Lost`}
                </div>
                <div className="text-sm mt-0.5 text-muted-foreground">
                  Ball landed on{' '}
                  <span
                    className="font-bold"
                    style={{ color: resultColor === 'red' ? '#f87171' : resultColor === 'black' ? 'hsl(var(--muted-foreground))' : '#4ade80' }}
                  >
                    {resultLabel}
                  </span>
                  {' '}({resultColor})
                  {data.won && (
                    <span className="text-foreground ml-1">
                      · Collects ${data.winAmt.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer close button */}
        <div className="px-4 py-3 flex-shrink-0 border-t border-foreground/10">
          <Button variant="outline" className="h-11 w-full" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
