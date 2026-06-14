import React, { useMemo, useState, useEffect, useRef } from "react";
import { setDropdownOpen } from "./ui/dropdown-menu";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
import PlayerAvatar from "./PlayerAvatar";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Player = { id: string; name: string; balance?: number };

export default function PayPopup({
  open,
  onOpenChange,
  mode,
  currentPlayer,
  players = [],
  showBalances = true,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "bank" | "players" | "tax" | null;
  currentPlayer: Player | null;
  players?: Player[];
  showBalances?: boolean;
  onSubmit: (payments: { to: string | null; amount: number }[], opts?: { freeParking?: boolean; description?: string | null }) => void;
}) {
  const others = useMemo(() => {
    if (!players) return [];
    return players
      .filter((p) => p.id !== currentPlayer?.id && !(p as any).is_bankrupt)
      .sort((a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0);
  }, [players, currentPlayer]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountPer, setAmountPer] = useState<number>(0);
  const [rawAmount, setRawAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const prevOpenRef = React.useRef<boolean>(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    if (!prev && open) {
      setSelectedIds(new Set());
      setAmountPer(0);
      setRawAmount("");
      setMessage("");
      if (mode !== 'tax') {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  if (!mode) return null;

  const roundToFive = (v: number) => Math.max(0, Math.ceil(v / 5) * 5);
  const count = selectedIds.size || (mode === "bank" ? 1 : 0);
  const rawAmountNum = rawAmount.trim() !== "" ? Number(rawAmount) || 0 : NaN;
  const roundedLive = !Number.isNaN(rawAmountNum) ? roundToFive(rawAmountNum) : amountPer;
  const total = mode === "tax"
    ? (amountPer === 0 ? 0 : roundedLive)
    : (mode === "bank" ? roundedLive : roundedLive * count);

  const togglePlayer = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = () => {
    if (!currentPlayer) return;
    const rounded = rawAmount.trim() !== "" ? roundToFive(Number(rawAmount)) : amountPer;
    setRawAmount(String(rounded));
    let payments: { to: string | null; amount: number }[] = [];
    if (mode === "bank") {
      payments = [{ to: null, amount: rounded }];
    } else if (mode === "tax") {
      payments = [{ to: null, amount: rounded }];
    } else {
      payments = Array.from(selectedIds).map((id) => ({ to: id, amount: rounded }));
    }
    onSubmit(payments, { freeParking: mode === "tax", description: message || null });
    onOpenChange(false);
  };

  const balance = Math.max(0, Number(currentPlayer?.balance ?? 0));
  const insufficientFunds = total > balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
      <DialogOverlay className="fixed inset-0 z-[100000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay — {mode === "bank" ? "Bank" : mode === "tax" ? "Tax" : "Players"}</DialogTitle>
          <DialogDescription>
            {mode === "bank" && "Pay the bank. This will deduct the amount from your balance."}
            {mode === "players" && "Select one or more players to pay. Amount below is per player."}
            {mode === "tax" && "Both Luxury Tax and Income Tax are sent to Free Parking."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "players" && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Choose recipients</div>
              <div className="grid gap-2">
                {others.length === 0 && <div className="text-sm text-muted-foreground">No other players</div>}
                {others.map((p) => (
                  <label key={p.id} className={`flex items-center gap-2 p-2 border rounded ${selectedIds.has(p.id) ? 'bg-primary/10' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />
                    <PlayerAvatar player={p} size="sm" />
                    <div className="flex-1">{p.name}</div>
                    {showBalances && (
                      <div className="text-sm text-muted-foreground">${(p.balance ?? 0).toLocaleString()}</div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === 'tax' ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Tax Type</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAmountPer(100); setRawAmount('100'); }}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium shadow-sm flex-1 transition-colors
                    ${amountPer === 100
                      ? 'bg-white text-black border-black'
                      : 'bg-muted text-foreground border border-input hover:bg-accent hover:text-accent-foreground'}`}
                >
                  Luxury Tax — $100
                </button>
                <button
                  type="button"
                  onClick={() => { setAmountPer(200); setRawAmount('200'); }}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium shadow-sm flex-1 transition-colors
                    ${amountPer === 200
                      ? 'bg-white text-black border-black'
                      : 'bg-muted text-foreground border border-input hover:bg-accent hover:text-accent-foreground'}`}
                >
                  Income Tax — $200
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Amount{mode === 'players' && count > 1 ? ' per player' : ''}
                </div>
                {mode === 'players' && count > 1 && (
                  <div className="text-sm text-muted-foreground">Total: ${total.toLocaleString()}</div>
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
              <div className="text-xs text-muted-foreground">
                Rounds up to nearest $5 · Balance: ${balance.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {mode === 'players' && (
          <div className="mt-4">
            <div className="text-sm font-medium">Leave a message (optional)</div>
            <Input
              value={message}
              onChange={(e: any) => setMessage(e.target.value)}
              className="w-full mt-2 h-10 rounded bg-muted border border-input px-3"
              placeholder="Write a short message"
              maxLength={200}
              type="text"
            />
          </div>
        )}

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              className={`bg-primary${insufficientFunds ? ' opacity-60 cursor-not-allowed' : ''}`}
              disabled={
                (mode === 'players' && selectedIds.size === 0) ||
                (mode === 'tax' && amountPer === 0) ||
                ((mode === 'bank' || mode === 'players') && rawAmount.trim() === '') ||
                insufficientFunds
              }
            >
              Pay
            </Button>
          </div>
        </DialogFooter>
        {insufficientFunds && (
          <div className="mt-3 text-sm text-destructive">Insufficient funds — you have ${balance.toLocaleString()}</div>
        )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
