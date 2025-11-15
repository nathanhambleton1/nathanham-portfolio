import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Player = { id: string; name: string; pending_sips?: number };

export default function SipPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  players?: Player[];
  onSubmit: (to: string, sip_count: number) => void;
}) {
  const others = useMemo(() => players.filter((p) => p.id !== currentPlayer?.id), [players, currentPlayer]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sipCount, setSipCount] = useState<number>(1);

  // reset when opened
  const prevOpen = React.useRef(false);
  useEffect(() => {
    if (!prevOpen.current && open) {
      setSelectedId(null);
      setSipCount(1);
    }
    prevOpen.current = open;
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!selectedId) return;
    onSubmit(selectedId, Math.max(1, Math.round(sipCount)));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give Sips</DialogTitle>
          <DialogDescription>Select a player and how many sips to assign.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Choose recipient</div>
            <div className="grid gap-2">
              {others.length === 0 && <div className="text-sm text-muted-foreground">No other players</div>}
              {others.map((p) => (
                <label key={p.id} className={`flex items-center gap-2 p-2 border rounded ${selectedId === p.id ? 'bg-primary/10' : ''}`}>
                  <input type="radio" name="sip-recipient" checked={selectedId === p.id} onChange={() => setSelectedId(p.id)} />
                  <div className="flex-1">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{(p.pending_sips || 0) > 0 ? `${p.pending_sips} pending` : ''}</div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Sips</div>
              <div className="text-sm text-muted-foreground">{sipCount}</div>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={sipCount}
              onChange={(e) => setSipCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Input
                value={String(sipCount)}
                onChange={(e) => setSipCount(Math.max(1, Number(e.target.value || 1)))}
                className="w-32"
                type="number"
                min={1}
              />
              <div className="text-sm text-muted-foreground">Total Sips</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-primary" disabled={!selectedId}>Give</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
