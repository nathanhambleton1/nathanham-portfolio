import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

export default function JailPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  onSubmit,
  showBalances = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: any | null;
  players?: any[];
  onSubmit: (targetPlayerId: string) => void;
  showBalances?: boolean;
}) {
  const list = useMemo(() => {
    if (!players) return [];
    // Separate current player and others
    const current = players.find(p => p.id === currentPlayer?.id);
    const others = players.filter(p => p.id !== currentPlayer?.id).sort((a, b) => {
      if (a.name && b.name) {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
    return current ? [current, ...others] : others;
  }, [players, currentPlayer]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Player To Jail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm font-medium">Choose a player to send to jail</div>
          <div className="grid gap-2">
            {list.length === 0 && <div className="text-sm text-muted-foreground">No players</div>}
            {list.map((p) => (
              <label key={p.id} className={`flex items-center gap-2 p-2 border rounded ${selected === p.id ? 'bg-primary/10' : ''}`}>
                <input
                  type="radio"
                  name="jail-target"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                />
                <div className="flex-1">{p.name}{p.id === currentPlayer?.id ? ' (you)' : ''}</div>
                {showBalances && (
                  <div className="text-sm text-muted-foreground">${(p.balance ?? 0).toLocaleString()}</div>
                )}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!selected} onClick={() => { if (selected) { onSubmit(selected); onOpenChange(false); } }}>Send to Jail</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
