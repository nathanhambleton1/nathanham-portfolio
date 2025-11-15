import React, { useEffect, useState } from 'react';
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'bank' | 'pass_go' | 'free_parking' | null;
  currentPlayer: any | null;
  game: any | null;
  onCollect: (opts: any) => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [doubled, setDoubled] = useState(false);
  const clampToFive = (v: number) => Math.max(0, Math.round(v / 5) * 5);

  useEffect(() => {
    if (open) {
      setAmount(0);
      setDoubled(false);
      if (mode === 'pass_go' && game) setAmount(game.pass_go_amount || 200);
      if (mode === 'free_parking' && game) setAmount(game.free_parking_balance || 0);
    }
  }, [open, mode, game]);

  if (!mode) return null;

  const handleSubmit = () => {
    if (!currentPlayer) return;
    if (mode === 'bank') {
      if (amount <= 0) return alert('Enter a valid amount');
      onCollect({ type: 'bank', amount });
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
            {mode === 'free_parking' && 'Collect the Free Parking pot (this will empty it).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'bank' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Amount</div>
                <div className="text-sm text-muted-foreground">Total: ${amount.toLocaleString()}</div>
              </div>
              <input
                type="range"
                min={0}
                max={2000}
                step={5}
                value={amount}
                onChange={(e) => setAmount(clampToFive(Number(e.target.value)))}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                <Input
                  value={String(amount)}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setAmount(clampToFive(v));
                  }}
                  className="w-32"
                  type="number"
                  step={5}
                  min={0}
                />
                <div className="text-sm text-muted-foreground">increments of 5</div>
              </div>
            </div>
          )}

          {mode === 'pass_go' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={doubled} onChange={(e) => setDoubled(e.target.checked)} />
                <div className="text-sm">Double for landing (collect {(game?.pass_go_amount || 200) * 2})</div>
              </label>
              <div className="text-sm text-muted-foreground">Base: ${game?.pass_go_amount || 200}</div>
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
            <Button onClick={handleSubmit} className="bg-primary">Collect</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
