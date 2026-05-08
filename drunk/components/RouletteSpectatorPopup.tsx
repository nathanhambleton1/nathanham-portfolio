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
        className="p-0 border border-border overflow-hidden max-w-sm w-full bg-background"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-center gap-2">
            {data.spinnerAvatar && (
              <img src={data.spinnerAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0" />
            )}
            <div className="text-center">
              <div className="text-sm font-bold text-foreground leading-tight">
                {data.spinnerName || 'A player'} is gambling!
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ${data.amount.toLocaleString()} on{' '}
                <span className="font-semibold text-foreground">{data.betLabel}</span>
                {' '}·{' '}
                <span className="text-primary">{oddsLabel}</span>
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
              <p className="text-primary animate-pulse font-semibold text-sm">Spinning...</p>
            )}
            {phase === 'result' && (
              <div>
                <div className={`text-xl font-bold ${data.won ? 'text-primary' : 'text-destructive'}`}>
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
        <div className="px-4 py-3 flex-shrink-0 border-t border-border">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
