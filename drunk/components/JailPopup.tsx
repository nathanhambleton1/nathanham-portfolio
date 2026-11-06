import React, { useEffect, useMemo, useState } from 'react';
import { setDropdownOpen } from './ui/dropdown-menu';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import PlayerAvatar from './PlayerAvatar';

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
    // Separate current player and others. Exclude bankrupt players.
    // Do NOT include the current player when they are bankrupt (spectator/ghost).
    const current = players.find(p => p.id === currentPlayer?.id && !(p as any).is_bankrupt);
    const others = players
      .filter(p => p.id !== currentPlayer?.id && !(p as any).is_bankrupt)
      .sort((a, b) => {
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

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="items-center sm:items-start">
          <img src="/drunkopoly/police.webp" alt="" aria-hidden draggable={false} className="mb-2 h-20 w-auto max-w-[70%] select-none object-contain" />
          <DialogTitle>Send Player To Jail</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Choose a player to send to jail</div>
          <div className="grid gap-2">
            {list.length === 0 && <div className="text-sm text-muted-foreground">No players</div>}
            {list.map((p) => (
              <label key={p.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition duration-200 ${selected === p.id ? 'border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30' : 'border-foreground/10 bg-foreground/[0.03] hover:border-brand/40'}`}>
                <input
                  className="h-4 w-4 shrink-0 accent-[hsl(var(--brand))]"
                  type="radio"
                  name="jail-target"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                />
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}{p.id === currentPlayer?.id && <span className="font-normal text-muted-foreground"> (you)</span>}</div>
                {showBalances && (
                  <div className="text-sm tabular-nums text-muted-foreground">${(p.balance ?? 0).toLocaleString()}</div>
                )}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="h-11 sm:h-10" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="destructive" className="h-11 sm:h-10" disabled={!selected} onClick={() => { if (selected) { onSubmit(selected); onOpenChange(false); } }}>Send to Jail</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
