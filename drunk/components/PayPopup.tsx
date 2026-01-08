import React, { useMemo, useState, useEffect } from "react";
import { setDropdownOpen } from "./ui/dropdown-menu";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
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
  // Free parking is always used for tax mode
  const others = useMemo(() => {
    if (!players) return [];
    // Exclude current player and bankrupt players, sort others alphabetically
    const otherPlayers = players
      .filter((p) => p.id !== currentPlayer?.id && !(p as any).is_bankrupt)
      .sort((a, b) => {
        if (a.name && b.name) {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    return otherPlayers;
  }, [players, currentPlayer]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // For tax mode, start with no amount selected; for others, default to 5
  const [amountPer, setAmountPer] = useState<number>(mode === 'tax' ? 0 : 5);
  // keep the typed input separate from the slider value; start blank so users can type immediately
  const [rawAmount, setRawAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  // Initialize popup state only when the dialog actually opens (avoid resets during polling updates)
  const prevOpenRef = React.useRef<boolean>(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    if (!prev && open) {
      setSelectedIds(new Set()); // Always start with no selection
      setAmountPer(mode === 'tax' ? 0 : 5);
      setRawAmount("");
      setMessage("");
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  if (!mode) return null;

  // For tax, always 1 payment (to bank or free parking), not per player
  // Round up to the nearest $5 (always upward), never below 0
  const roundToFive = (v: number) => Math.max(0, Math.ceil(v / 5) * 5);
  const count = selectedIds.size || (mode === "bank" ? 1 : 0);
  // If the user has typed an amount, use that (rounded). Otherwise fall back to slider `amountPer`.
  const rawAmountNum = rawAmount.trim() !== "" ? Number(rawAmount) || 0 : NaN;
  const roundedLive = !Number.isNaN(rawAmountNum) ? roundToFive(rawAmountNum) : amountPer;
  // For tax mode, if nothing is selected, total should be $0
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
    // Use typed value if present, otherwise fall back to slider
    const rounded = rawAmount.trim() !== "" ? roundToFive(Number(rawAmount)) : amountPer;
    setAmountPer(Math.min(rounded, visibleSliderMax));
    setRawAmount(String(rounded));
    let payments: { to: string | null; amount: number }[] = [];
    if (mode === "bank") {
      payments = [{ to: null, amount: rounded }];
    } else if (mode === "tax") {
      payments = [{ to: null, amount: rounded }];
    } else {
      const ids = Array.from(selectedIds);
      payments = ids.map((id) => ({ to: id, amount: rounded }));
    }
    onSubmit(payments, { freeParking: mode === "tax", description: message || null });
    onOpenChange(false);
  };

  // Slider should be either 100 or the player's balance if it is lower than 100
  const visibleSliderMax = Math.min(100, Math.max(0, Number(currentPlayer?.balance ?? 100)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[100000] bg-black/80" />
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
          {/* Only show recipients for players mode */}
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
                    <div className="flex-1">{p.name}</div>
                    {showBalances && (
                      <div className="text-sm text-muted-foreground">${(p.balance ?? 0).toLocaleString()}</div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Amount</div>
              <div className="text-sm text-muted-foreground">Total: ${total.toLocaleString()}</div>
            </div>
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
              <>
                <input
                  type="range"
                  min={0}
                  max={visibleSliderMax}
                  step={5}
                  value={amountPer}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    // If the user moves the slider after typing a manual amount,
                    // clear the manual input so the slider regains control.
                    if (rawAmount.trim() !== "") setRawAmount("");
                    setAmountPer(Math.max(0, Math.round(v / 5) * 5));
                  }}
                  aria-label="Payment amount"
                  className="w-full touch-range"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={rawAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRawAmount(v);
                      const num = v.trim() !== '' ? Number(v) : NaN;
                      if (!Number.isNaN(num)) {
                        const rounded = roundToFive(num);
                        setAmountPer(Math.min(rounded, visibleSliderMax));
                      }
                    }}
                    onBlur={() => {
                      // On blur, if user entered something, round and sync slider (slider capped at visible max)
                      if (rawAmount.trim() !== "") {
                        const rounded = roundToFive(Number(rawAmount));
                        setAmountPer(Math.min(rounded, visibleSliderMax));
                        setRawAmount(String(rounded));
                      }
                    }}
                    className="w-32"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 50"
                    min={0}
                  />
                  <div className="text-sm text-muted-foreground">Rounds up to $5</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Optional message for recipients — only show when paying players */}
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
              className={`bg-primary${(roundedLive > (currentPlayer?.balance ?? 0)) ? ' opacity-60 cursor-not-allowed' : ''}`}
              disabled={
                (mode === 'players' && selectedIds.size === 0) ||
                (roundedLive > (currentPlayer?.balance ?? 0))
              }
            >
              Pay
            </Button>
          </div>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
