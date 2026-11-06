import React, { useEffect, useState, useRef } from 'react';
import { setDropdownOpen } from './ui/dropdown-menu';
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function CollectPopup({
  open,
  onOpenChange,
  mode,
  currentPlayer,
  game,
  onCollect,
  gamblingEnabled,
  onGamble,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'bank' | 'pass_go' | 'free_parking' | null;
  currentPlayer: any | null;
  game: any | null;
  onCollect: (opts: any) => void;
  gamblingEnabled?: boolean;
  onGamble?: (amount: number, doubled: boolean) => void;
}) {
  const [rawAmount, setRawAmount] = useState<string>("");
  const [doubled, setDoubled] = useState(false);
  const roundToFive = (v: number) => Math.max(0, Math.ceil(v / 5) * 5);
  const inputRef = useRef<HTMLInputElement>(null);

  const prevOpenRef = React.useRef<boolean>(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    if (!prev && open) {
      setRawAmount("");
      setDoubled(false);
      if (mode === 'bank') {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    }
    prevOpenRef.current = open;
  }, [open, mode]);

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  if (!mode) return null;

  const roundedLive = rawAmount.trim() !== "" ? roundToFive(Number(rawAmount) || 0) : 0;

  const handleSubmit = () => {
    if (!currentPlayer) return;
    if (mode === 'bank') {
      const rounded = roundToFive(Number(rawAmount) || 0);
      if (rounded <= 0) return alert('Enter a valid amount');
      setRawAmount(String(rounded));
      onCollect({ type: 'bank', amount: rounded });
    } else if (mode === 'pass_go') {
      onCollect({ type: 'pass_go', doubled });
    } else if (mode === 'free_parking') {
      onCollect({ type: 'free_parking' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="items-center sm:items-start">
          <img
            src={mode === 'pass_go' ? '/drunkopoly/pass_go.webp' : mode === 'free_parking' ? '/drunkopoly/free_parking.webp' : '/drunkopoly/play_money.webp'}
            alt=""
            aria-hidden
            draggable={false}
            className="mb-2 h-20 w-auto max-w-[70%] select-none object-contain"
          />
          <DialogTitle>Collect — {mode === 'bank' ? 'Bank' : mode === 'pass_go' ? 'Pass Go' : 'Free Parking'}</DialogTitle>
          <DialogDescription>
            {mode === 'bank' && 'Collect a custom amount from the bank.'}
            {mode === 'pass_go' && 'Collect your pass go amount (can be doubled if landing).'}
            {mode === 'free_parking' && 'Collect the Free Parking pot.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'bank' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Amount</div>
                {roundedLive > 0 && (
                  <div className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs tabular-nums text-muted-foreground">${roundedLive.toLocaleString()}</div>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl font-semibold text-muted-foreground select-none pointer-events-none">$</span>
                <Input
                  ref={inputRef}
                  value={rawAmount}
                  onChange={(e) => {
                    setRawAmount(e.target.value.replace(/[^0-9]/g, ''));
                  }}
                  onBlur={() => {
                    if (rawAmount.trim() !== "") {
                      setRawAmount(String(roundToFive(Number(rawAmount))));
                    }
                  }}
                  className="h-14 pl-9 font-display text-2xl font-semibold tracking-tight md:text-2xl"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  min={0}
                />
              </div>
              <div className="text-xs text-muted-foreground">Rounds up to nearest $5</div>
            </div>
          )}

          {mode === 'pass_go' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Base</div>
                <div className="mt-1 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-display text-4xl font-bold tracking-tight text-transparent">${(game?.pass_go_amount || 200).toLocaleString()}</div>
              </div>
              <label className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition duration-200 ${doubled ? 'border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30' : 'border-foreground/10 bg-foreground/[0.03] hover:border-brand/40'}`}>
                <input className="h-4 w-4 shrink-0 accent-[hsl(var(--brand))]" type="checkbox" checked={doubled} onChange={(e) => setDoubled(e.target.checked)} />
                <div className="text-sm">Double for landing (collect <span className="font-semibold tabular-nums text-emerald-500">${((game?.pass_go_amount || 200) * 2).toLocaleString()}</span>)</div>
              </label>
            </div>
          )}

          {mode === 'free_parking' && (
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Free Parking pot</div>
              <div className="mt-1 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-display text-4xl font-bold tracking-tight text-transparent">${(game?.free_parking_balance || 0).toLocaleString()}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="h-11 sm:h-10" onMouseDown={(e) => e.preventDefault()} onClick={() => onOpenChange(false)}>Cancel</Button>
            {gamblingEnabled && (mode === 'free_parking' || (mode === 'pass_go' && doubled)) && (
              <Button
                variant="outline"
                className="h-11 border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/60 hover:bg-destructive/15 hover:text-destructive sm:h-10"
                disabled={mode === 'free_parking' && (game?.free_parking_balance || 0) === 0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const gambleAmt =
                    mode === 'pass_go'
                      ? (game?.pass_go_amount || 200) * 2
                      : (game?.free_parking_balance || 0);
                  if (onGamble) onGamble(gambleAmt, doubled);
                  onOpenChange(false);
                }}
              >
                Gamble
              </Button>
            )}
            <Button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSubmit}
              className="h-11 sm:h-10"
              disabled={
                (mode === 'bank' && rawAmount.trim() === '') ||
                (mode === 'free_parking' && (game?.free_parking_balance || 0) === 0)
              }
            >
              Collect
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
