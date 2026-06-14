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
        <DialogHeader>
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
                <div className="text-sm font-medium">Amount</div>
                {roundedLive > 0 && (
                  <div className="text-sm text-muted-foreground">${roundedLive.toLocaleString()}</div>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">$</span>
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
                  className="pl-7 text-lg h-12"
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
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={doubled} onChange={(e) => setDoubled(e.target.checked)} />
                <div className="text-sm">Double for landing (collect ${((game?.pass_go_amount || 200) * 2).toLocaleString()})</div>
              </label>
              <div className="text-sm text-muted-foreground">Base: ${(game?.pass_go_amount || 200).toLocaleString()}</div>
            </div>
          )}

          {mode === 'free_parking' && (
            <div>
              <div className="text-sm">Free Parking pot:</div>
              <div className="text-lg font-bold">${(game?.free_parking_balance || 0).toLocaleString()}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            {gamblingEnabled && (mode === 'free_parking' || (mode === 'pass_go' && doubled)) && (
              <Button
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                disabled={mode === 'free_parking' && (game?.free_parking_balance || 0) === 0}
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
              onClick={handleSubmit}
              className="bg-primary"
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
